import { env } from '../config/env.js';
import { OtpChallenge } from '../models/otp-challenge.model.js';
import { AppError } from '../utils/app-error.js';
import { createOtp, hashOtp, otpMatches } from '../utils/crypto.js';
import { sendOtpEmail } from './email.service.js';

export async function issueOtpChallenge({
  email,
  purpose,
  companyName = null,
  hideCooldown = false,
}) {
  const now = new Date();
  const recentChallenge = await OtpChallenge.findOne({
    email,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (recentChallenge && recentChallenge.resendAvailableAt > now) {
    if (hideCooldown) return null;

    const retryAfter = Math.ceil((recentChallenge.resendAvailableAt - now) / 1_000);
    throw new AppError(429, 'OTP_RESEND_TOO_SOON', `Request a new code in ${retryAfter} seconds`, {
      retryAfter,
    });
  }

  // Superseded codes are consumed so only the newest email can ever succeed.
  await OtpChallenge.updateMany(
    { email, purpose, consumedAt: null },
    { $set: { consumedAt: now } }
  );

  const code = createOtp();
  const challenge = new OtpChallenge({
    email,
    purpose,
    companyName,
    codeHash: 'pending',
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    expiresAt: new Date(now.getTime() + env.OTP_TTL_MINUTES * 60_000),
    resendAvailableAt: new Date(now.getTime() + env.OTP_RESEND_SECONDS * 1_000),
  });
  challenge.codeHash = hashOtp({ challengeId: challenge.id, code });
  await challenge.save();

  try {
    await sendOtpEmail({ to: email, code, purpose });
  } catch (error) {
    // Do not leave behind a usable code that the user never received.
    await OtpChallenge.deleteOne({ _id: challenge.id });
    throw error;
  }

  return challenge;
}

async function consumeChallenge(challenge, code) {
  const now = new Date();

  if (!challenge || challenge.consumedAt) {
    throw new AppError(400, 'OTP_INVALID', 'The verification code is invalid or expired');
  }
  if (challenge.expiresAt <= now) {
    throw new AppError(400, 'OTP_EXPIRED', 'The verification code has expired');
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts; request a new code');
  }

  if (!otpMatches({ challengeId: challenge.id, code, expectedHash: challenge.codeHash })) {
    const updated = await OtpChallenge.findOneAndUpdate(
      { _id: challenge.id, consumedAt: null, attempts: { $lt: challenge.maxAttempts } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    );
    const attemptsLeft = Math.max(0, challenge.maxAttempts - (updated?.attempts ?? challenge.maxAttempts));
    throw new AppError(400, 'OTP_INVALID', 'The verification code is invalid or expired', {
      attemptsLeft,
    });
  }

  const consumed = await OtpChallenge.findOneAndUpdate(
    {
      _id: challenge.id,
      consumedAt: null,
      attempts: { $lt: challenge.maxAttempts },
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { returnDocument: 'after' }
  );

  if (!consumed) {
    throw new AppError(400, 'OTP_ALREADY_USED', 'The verification code has already been used');
  }

  return consumed;
}

export async function consumeOtpById({ challengeId, purpose, code }) {
  const challenge = await OtpChallenge.findOne({ _id: challengeId, purpose }).select('+codeHash');
  return consumeChallenge(challenge, code);
}

export async function consumeLatestOtp({ email, purpose, code }) {
  const challenge = await OtpChallenge.findOne({ email, purpose, consumedAt: null })
    .sort({ createdAt: -1 })
    .select('+codeHash');
  return consumeChallenge(challenge, code);
}
