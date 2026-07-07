import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
};

// Creating this once gives unknown-email logins roughly the same password work as real users.
const dummyHashPromise = argon2.hash('not-a-real-user-password', ARGON2_OPTIONS);

export function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash, password) {
  return argon2.verify(passwordHash, password);
}

export async function verifyPasswordWithoutRevealingUser(passwordHash, password) {
  return verifyPassword(passwordHash ?? (await dummyHashPromise), password);
}

