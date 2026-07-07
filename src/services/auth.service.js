import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  getApprovedCompanyForEmail,
  getEmailDomain,
  isApprovedCompanyEmail,
} from '../data/approved-company-domains.js';
import { RefreshSession } from '../models/refresh-session.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';
import { createOpaqueToken, hashOpaqueToken } from '../utils/crypto.js';
import { issueOtpChallenge, consumeLatestOtp, consumeOtpById } from './otp.service.js';
import { hashPassword, verifyPasswordWithoutRevealingUser } from './password.service.js';
import {
  signAccessToken,
  signRegistrationToken,
  verifyRegistrationToken,
} from './token.service.js';

const commonPasswords = new Set([
  '1234567890',
  'password123',
  'qwerty12345',
  'letmein1234',
  'iloveyou123',
]);

function assertAcceptablePassword(password, email) {
  const normalized = password.toLowerCase();
  const emailName = email.split('@')[0].toLowerCase();

  if (commonPasswords.has(normalized) || normalized.includes(emailName)) {
    throw new AppError(
      400,
      'WEAK_PASSWORD',
      'Choose a password that is not common and does not contain your email name'
    );
  }
}

function sessionMetadata(metadata) {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 64) || null,
    userAgent: metadata.userAgent?.slice(0, 512) || null,
  };
}

async function createRefreshSession(userId, metadata) {
  const refreshToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await RefreshSession.create({
    userId,
    tokenHash,
    expiresAt,
    ...sessionMetadata(metadata),
  });

  return { refreshToken, tokenHash, expiresAt };
}

async function issueTokenPair(user, metadata) {
  const [accessToken, refresh] = await Promise.all([
    signAccessToken(user),
    createRefreshSession(user.id, metadata),
  ]);

  return {
    accessToken,
    accessTokenExpiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    refreshToken: refresh.refreshToken,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

export async function requestWorkEmailOtp({ email }) {
  const company = getApprovedCompanyForEmail(email);
  if (!company) {
    throw new AppError(400, 'COMPANY_EMAIL_REQUIRED', 'Choose an approved company email address');
  }

  const existingUser = await User.exists({ workEmail: email, status: { $ne: 'deleted' } });
  if (existingUser) {
    throw new AppError(409, 'ACCOUNT_EXISTS', 'An account already exists for this work email');
  }

  const challenge = await issueOtpChallenge({
    email,
    purpose: 'work_email_verification',
    companyName: company.name,
  });

  return {
    challengeId: challenge.id,
    email: challenge.email,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: challenge.resendAvailableAt,
  };
}

export async function verifyWorkEmailOtp({ challengeId, code }) {
  const challenge = await consumeOtpById({
    challengeId,
    code,
    purpose: 'work_email_verification',
  });
  const companyDomain = getEmailDomain(challenge.email);
  const verifiedAt = new Date().toISOString();
  const registrationToken = await signRegistrationToken({
    email: challenge.email,
    companyName: challenge.companyName,
    companyDomain,
    verifiedAt,
  });

  return {
    registrationToken,
    registrationTokenExpiresInSeconds: env.REGISTRATION_TOKEN_TTL_MINUTES * 60,
    email: challenge.email,
    companyName: challenge.companyName,
    companyDomain,
    verifiedAt,
  };
}

export async function registerAccount(input, metadata) {
  const verification = await verifyRegistrationToken(input.registrationToken);
  const workEmail = verification.email.toLowerCase();
  const personalEmail = input.personalEmail.toLowerCase();

  if (!isApprovedCompanyEmail(workEmail)) {
    throw new AppError(400, 'COMPANY_EMAIL_REQUIRED', 'The verified company is not approved');
  }
  if (personalEmail === workEmail) {
    throw new AppError(400, 'PERSONAL_EMAIL_REQUIRED', 'Personal email must differ from work email');
  }

  assertAcceptablePassword(input.password, workEmail);
  const existing = await User.exists({
    $or: [{ workEmail }, { personalEmail }],
    status: { $ne: 'deleted' },
  });
  if (existing) {
    throw new AppError(409, 'ACCOUNT_EXISTS', 'An account already uses one of these email addresses');
  }

  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    workEmail,
    personalEmail,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    profilePhotoUrl: input.profilePhotoUrl ?? null,
    company: {
      name: verification.companyName,
      domain: verification.companyDomain,
    },
    jobTitle: input.jobTitle,
    department: input.department,
    industry: input.industry,
    careerLevel: input.careerLevel,
    location: input.location,
    shortBio: input.shortBio,
    linkedinUrl: input.linkedinUrl,
    professionalInterests: [...new Set(input.professionalInterests)],
    lookingFor: [...new Set(input.lookingFor)],
    emailVerifiedAt: new Date(verification.verifiedAt),
    profileCompletedAt: now,
    passwordChangedAt: now,
    lastLoginAt: now,
  });

  return { user, ...(await issueTokenPair(user, metadata)) };
}

export async function login({ email, password }, metadata) {
  const user = await User.findOne({ workEmail: email }).select('+passwordHash +tokenVersion');
  const passwordValid = await verifyPasswordWithoutRevealingUser(user?.passwordHash, password);

  if (!user || !passwordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is not available');
  }

  user.lastLoginAt = new Date();
  await user.save();
  return { user, ...(await issueTokenPair(user, metadata)) };
}

async function respondToRefreshReuse(session) {
  if (session?.userId) {
    await Promise.all([
      RefreshSession.updateMany(
        { userId: session.userId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'refresh_token_reuse' } }
      ),
      User.updateOne({ _id: session.userId }, { $inc: { tokenVersion: 1 } }),
    ]);
  }
  throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
}

export async function refreshAuthToken(rawToken, metadata) {
  const tokenHash = hashOpaqueToken(rawToken);
  const session = await RefreshSession.findOne({ tokenHash }).select(
    '+tokenHash +replacedByTokenHash'
  );

  if (!session || session.expiresAt <= new Date()) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }
  if (session.revokedAt) {
    return respondToRefreshReuse(session);
  }

  const user = await User.findById(session.userId).select('+tokenVersion');
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }

  const replacement = await createRefreshSession(user.id, metadata);
  const rotated = await RefreshSession.findOneAndUpdate(
    { _id: session.id, revokedAt: null, expiresAt: { $gt: new Date() } },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: 'rotated',
        replacedByTokenHash: replacement.tokenHash,
        lastUsedAt: new Date(),
      },
    }
  );

  if (!rotated) {
    await RefreshSession.deleteOne({ tokenHash: replacement.tokenHash });
    return respondToRefreshReuse(session);
  }

  return {
    user,
    accessToken: await signAccessToken(user),
    accessTokenExpiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    refreshToken: replacement.refreshToken,
    refreshTokenExpiresAt: replacement.expiresAt,
  };
}

export async function logout(rawToken, userId) {
  const tokenHash = hashOpaqueToken(rawToken);
  await RefreshSession.updateOne(
    { tokenHash, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } }
  );
}

export async function logoutEverywhere(userId) {
  await Promise.all([
    RefreshSession.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } }
    ),
    User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
  ]);
}

export async function requestPasswordReset(email) {
  try {
    const user = await User.findOne({ workEmail: email, status: 'active' }).select('_id');
    if (user) {
      await issueOtpChallenge({
        email,
        purpose: 'password_reset',
        hideCooldown: true,
      });
    }
  } catch (error) {
    // The public response remains identical so account and mail-delivery state stay private.
    logger.error({ err: error, email }, 'Unable to issue password reset email');
  }
}

export async function resetPassword({ email, code, password }) {
  assertAcceptablePassword(password, email);
  await consumeLatestOtp({ email, purpose: 'password_reset', code });

  const user = await User.findOne({ workEmail: email, status: 'active' }).select(
    '+tokenVersion'
  );
  if (!user) {
    throw new AppError(400, 'OTP_INVALID', 'The verification code is invalid or expired');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.tokenVersion += 1;
  await user.save();
  await RefreshSession.updateMany(
    { userId: user.id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'password_reset' } }
  );
}
