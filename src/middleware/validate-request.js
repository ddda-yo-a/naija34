import { AppError } from '../utils/app-error.js';

export function validateRequest(schema) {
  return function validationMiddleware(request, _response, next) {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.').replace(/^body\./, ''),
        message: issue.message,
      }));
      return next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details));
    }

    // Controllers receive normalized values, such as lower-cased and trimmed emails.
    if (result.data.body) request.body = result.data.body;
    next();
  };
}

