import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const issuer = 'naija34-api';
const mobileAudience = 'naija34-mobile';
const registrationAudience = 'naija34-registration';
const signingKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function signAccessToken(user) {
  return new SignJWT({ role: user.role, tokenVersion: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(mobileAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(signingKey);
}

export function signRegistrationToken({ email, companyName, companyDomain, verifiedAt }) {
  return new SignJWT({
    type: 'registration',
    email,
    companyName,
    companyDomain,
    verifiedAt,
  })
    .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(registrationAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.REGISTRATION_TOKEN_TTL_MINUTES}m`)
    .sign(signingKey);
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ['HS512'],
      issuer,
      audience: mobileAudience,
    });
    return payload;
  } catch {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
  }
}

export async function verifyRegistrationToken(token) {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ['HS512'],
      issuer,
      audience: registrationAudience,
    });

    if (payload.type !== 'registration' || !payload.email || !payload.companyDomain) {
      throw new Error('Registration claims are missing');
    }

    return payload;
  } catch {
    throw new AppError(
      401,
      'INVALID_REGISTRATION_TOKEN',
      'Work email verification has expired; request a new code'
    );
  }
}

