import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  // These paths protect credentials if a request is accidentally logged in full.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.refreshToken',
      'req.body.code',
    ],
    censor: '[REDACTED]',
  },
});
