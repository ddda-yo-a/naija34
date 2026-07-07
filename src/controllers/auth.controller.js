import * as authService from '../services/auth.service.js';

function metadataFrom(request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
}

function authPayload(result) {
  return {
    user: result.user.toJSON(),
    accessToken: result.accessToken,
    accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
    refreshToken: result.refreshToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
  };
}

export async function requestWorkEmailOtp(request, response) {
  const data = await authService.requestWorkEmailOtp(request.body);
  response.status(202).json({
    success: true,
    message: 'Verification code sent to your work email',
    data,
  });
}

export async function verifyWorkEmailOtp(request, response) {
  const data = await authService.verifyWorkEmailOtp(request.body);
  response.json({
    success: true,
    message: 'Work email verified; complete your profile',
    data,
  });
}

export async function register(request, response) {
  const result = await authService.registerAccount(request.body, metadataFrom(request));
  response.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: authPayload(result),
  });
}

export async function login(request, response) {
  const result = await authService.login(request.body, metadataFrom(request));
  response.json({ success: true, message: 'Login successful', data: authPayload(result) });
}

export async function refresh(request, response) {
  const result = await authService.refreshAuthToken(
    request.body.refreshToken,
    metadataFrom(request)
  );
  response.json({ success: true, data: authPayload(result) });
}

export async function logout(request, response) {
  await authService.logout(request.body.refreshToken, request.auth.userId);
  response.json({ success: true, message: 'Logged out successfully' });
}

export async function logoutEverywhere(request, response) {
  await authService.logoutEverywhere(request.auth.userId);
  response.json({ success: true, message: 'Logged out on every device' });
}

export async function me(request, response) {
  response.json({ success: true, data: { user: request.user.toJSON() } });
}

export async function forgotPassword(request, response) {
  await authService.requestPasswordReset(request.body.email);
  response.status(202).json({
    success: true,
    message: 'If an active account matches that email, a reset code has been sent',
  });
}

export async function resetPassword(request, response) {
  await authService.resetPassword(request.body);
  response.json({
    success: true,
    message: 'Password reset successfully; log in with your new password',
  });
}

