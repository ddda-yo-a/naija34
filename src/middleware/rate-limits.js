import { rateLimit } from 'express-rate-limit';

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message },
      });
    },
  });
}

export const globalRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 300,
  message: 'Too many requests; please try again shortly',
});

export const otpRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 6,
  message: 'Too many code requests; please wait before trying again',
});

export const loginRateLimit = limiter({
  windowMs: 15 * 60_000,
  limit: 10,
  message: 'Too many login attempts; please try again later',
});

export const refreshRateLimit = limiter({
  windowMs: 5 * 60_000,
  limit: 30,
  message: 'Too many token refresh attempts; please try again later',
});

