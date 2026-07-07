import { createServer } from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const httpServer = createServer(app);
let shuttingDown = false;

async function start() {
  await connectDatabase();
  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Naija34 API is ready');
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  httpServer.close(async (serverError) => {
    try {
      await disconnectDatabase();
      if (serverError) throw serverError;
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exit(1);
    }
  });

  // A hard deadline prevents a stuck connection from hanging a deployment forever.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exit(1);
});

