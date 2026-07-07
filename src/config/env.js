import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().startsWith('/').default('/api/v1'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_ACCESS_SECRET: z.string().min(64, 'JWT_ACCESS_SECRET must be at least 64 characters'),
    OTP_PEPPER: z.string().min(64, 'OTP_PEPPER must be at least 64 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REGISTRATION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    CORS_ORIGINS: z.string().default('http://localhost:8081'),
    EMAIL_DELIVERY_MODE: z.enum(['log', 'smtp']).default('log'),
    EMAIL_FROM: z.string().min(1).default('34th Street <no-reply@34thstreet.example>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: booleanFromString.default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .superRefine((value, context) => {
    // Logging OTPs is convenient locally but would disclose secrets in production logs.
    if (value.NODE_ENV === 'production' && value.EMAIL_DELIVERY_MODE !== 'smtp') {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_DELIVERY_MODE'],
        message: 'Production must use EMAIL_DELIVERY_MODE=smtp',
      });
    }

    if (
      value.EMAIL_DELIVERY_MODE === 'smtp' &&
      (!value.SMTP_HOST || !value.SMTP_USER || !value.SMTP_PASS)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST, SMTP_USER, and SMTP_PASS are required in smtp mode',
      });
    }
  });

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const problems = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = {
  ...result.data,
  corsOrigins: result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

