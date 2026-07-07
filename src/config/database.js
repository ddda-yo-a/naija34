import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  // Mongoose buffers queries by default, which can hide a broken database connection.
  mongoose.set('bufferCommands', false);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

