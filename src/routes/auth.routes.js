import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimit, otpRateLimit, refreshRateLimit } from '../middleware/rate-limits.js';
import { validateRequest } from '../middleware/validate-request.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registrationSchema,
  requestWorkEmailOtpSchema,
  resetPasswordSchema,
  verifyWorkEmailOtpSchema,
} from '../validators/auth.validators.js';

export const authRouter = Router();

authRouter.post(
  '/work-email/request-otp',
  otpRateLimit,
  validateRequest(requestWorkEmailOtpSchema),
  asyncHandler(authController.requestWorkEmailOtp)
);
authRouter.post(
  '/work-email/resend-otp',
  otpRateLimit,
  validateRequest(requestWorkEmailOtpSchema),
  asyncHandler(authController.requestWorkEmailOtp)
);
authRouter.post(
  '/work-email/verify-otp',
  loginRateLimit,
  validateRequest(verifyWorkEmailOtpSchema),
  asyncHandler(authController.verifyWorkEmailOtp)
);
authRouter.post(
  '/register',
  loginRateLimit,
  validateRequest(registrationSchema),
  asyncHandler(authController.register)
);
authRouter.post(
  '/login',
  loginRateLimit,
  validateRequest(loginSchema),
  asyncHandler(authController.login)
);
authRouter.post(
  '/refresh',
  refreshRateLimit,
  validateRequest(refreshSchema),
  asyncHandler(authController.refresh)
);
authRouter.post(
  '/logout',
  authenticate,
  validateRequest(refreshSchema),
  asyncHandler(authController.logout)
);
authRouter.post('/logout-all', authenticate, asyncHandler(authController.logoutEverywhere));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
authRouter.post(
  '/password/forgot',
  otpRateLimit,
  validateRequest(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);
authRouter.post(
  '/password/resend-otp',
  otpRateLimit,
  validateRequest(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);
authRouter.post(
  '/password/reset',
  loginRateLimit,
  validateRequest(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

