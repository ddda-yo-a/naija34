import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const shortText = (maximum) => z.string().trim().min(1).max(maximum);
const password = z
  .string()
  .min(10, 'Password must contain at least 10 characters')
  .max(128, 'Password cannot exceed 128 characters');

const linkedInUrl = z
  .url()
  .max(2_048)
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  }, 'Use a valid LinkedIn URL');

export const requestWorkEmailOtpSchema = z.object({
  body: z.object({
    email,
    // companyName may be sent by older clients, but Zod strips it and the server derives its own.
  }),
});

export const verifyWorkEmailOtpSchema = z.object({
  body: z.object({
    challengeId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid challenge ID'),
    code: z.string().regex(/^\d{6}$/, 'Code must contain 6 digits'),
  }),
});

export const registrationSchema = z
  .object({
    body: z
      .object({
        registrationToken: z.string().min(20),
        password,
        confirmPassword: z.string(),
        fullName: shortText(100).refine(
          (value) => value.split(/\s+/).length >= 2,
          'Enter your first and last name'
        ),
        personalEmail: email,
        phone: z.string().trim().min(10).max(25),
        profilePhotoUrl: z.url().max(2_048).optional(),
        jobTitle: shortText(100),
        department: shortText(100),
        industry: shortText(80),
        careerLevel: z.enum([
          'Entry',
          'Associate',
          'Manager',
          'Senior',
          'Lead',
          'Executive',
          'Founder',
        ]),
        location: shortText(120),
        shortBio: z.string().trim().min(18).max(500),
        linkedinUrl: linkedInUrl,
        professionalInterests: z.array(shortText(50)).min(2).max(12),
        lookingFor: z.array(shortText(50)).min(1).max(7),
      })
      .superRefine((value, context) => {
        if (value.password !== value.confirmPassword) {
          context.addIssue({
            code: 'custom',
            path: ['confirmPassword'],
            message: 'Passwords do not match',
          });
        }
      }),
  });

export const loginSchema = z.object({
  body: z.object({ email, password: z.string().min(1).max(128) }),
});

export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(40) }),
});

export const forgotPasswordSchema = z.object({ body: z.object({ email }) });

export const resetPasswordSchema = z
  .object({
    body: z
      .object({
        email,
        code: z.string().regex(/^\d{6}$/, 'Code must contain 6 digits'),
        password,
        confirmPassword: z.string(),
      })
      .superRefine((value, context) => {
        if (value.password !== value.confirmPassword) {
          context.addIssue({
            code: 'custom',
            path: ['confirmPassword'],
            message: 'Passwords do not match',
          });
        }
      }),
  });
