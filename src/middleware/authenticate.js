import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { verifyAccessToken } from '../services/token.service.js';

export const authenticate = asyncHandler(async (request, _response, next) => {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'A Bearer access token is required');
  }

  const payload = await verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('+tokenVersion');

  if (
    !user ||
    user.status !== 'active' ||
    user.tokenVersion !== payload.tokenVersion
  ) {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
  }

  request.auth = { userId: user.id, role: user.role };
  request.user = user;
  next();
});

