import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test-placeholder',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-and-never-used-outside-tests-1234567890',
      OTP_PEPPER: 'test-otp-pepper-that-is-also-long-enough-and-only-used-in-automated-tests-1234',
      EMAIL_DELIVERY_MODE: 'log',
      CORS_ORIGINS: 'http://localhost:8081',
    },
  },
});

