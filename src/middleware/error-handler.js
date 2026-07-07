import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export function notFoundHandler(request, _response, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route matches ${request.method} ${request.path}`));
}

export function errorHandler(error, request, response, _next) {
  let normalized = error;

  if (error?.code === 11000) {
    normalized = new AppError(409, 'DUPLICATE_VALUE', 'An account already uses this information');
  } else if (error instanceof mongoose.Error.ValidationError) {
    normalized = new AppError(422, 'DATABASE_VALIDATION_ERROR', 'The submitted data is invalid');
  } else if (error instanceof mongoose.Error.CastError) {
    normalized = new AppError(400, 'INVALID_IDENTIFIER', 'A supplied identifier is invalid');
  } else if (error?.type === 'entity.parse.failed') {
    normalized = new AppError(400, 'INVALID_JSON', 'Request body contains invalid JSON');
  }

  const operational = normalized instanceof AppError;
  const statusCode = operational ? normalized.statusCode : 500;
  const code = operational ? normalized.code : 'INTERNAL_SERVER_ERROR';
  const message = operational ? normalized.message : 'An unexpected server error occurred';

  if (statusCode >= 500) {
    request.log?.error({ err: error }, 'Request failed');
  }

  response.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(normalized.details ? { details: normalized.details } : {}),
      ...(env.NODE_ENV === 'development' && !operational ? { stack: error.stack } : {}),
    },
  });
}

