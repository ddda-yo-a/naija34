import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { globalRateLimit } from './middleware/rate-limits.js';
import { authRouter } from './routes/auth.routes.js';
import { AppError } from './utils/app-error.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(
  pinoHttp({
    logger,
    genReqId(request, response) {
      const requestId = request.headers['x-request-id'] || randomUUID();
      response.setHeader('x-request-id', requestId);
      return requestId;
    },
  })
);
app.use(helmet());
app.use(
  cors({
    credentials: false,
    origin(origin, callback) {
      // Expo/native requests commonly have no Origin header; browser clients must be allow-listed.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed'));
    },
  })
);
app.use(express.json({ limit: '32kb' }));
app.use(globalRateLimit);

app.get('/health', (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  response.status(databaseConnected ? 200 : 503).json({
    success: true,
    data: {
      status: databaseConnected ? 'ok' : 'degraded',
      database: databaseConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(notFoundHandler);
app.use(errorHandler);
