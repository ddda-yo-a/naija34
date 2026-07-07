import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export function createOtp() {
  // randomInt uses a cryptographically secure source and avoids modulo bias.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp({ challengeId, code }) {
  return createHmac('sha256', env.OTP_PEPPER)
    .update(`${challengeId}:${code}`)
    .digest('hex');
}

export function otpMatches({ challengeId, code, expectedHash }) {
  const supplied = Buffer.from(hashOtp({ challengeId, code }), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createOpaqueToken() {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

