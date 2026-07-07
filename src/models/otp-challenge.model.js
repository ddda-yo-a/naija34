import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: {
      type: String,
      enum: ['work_email_verification', 'password_reset'],
      required: true,
      index: true,
    },
    companyName: { type: String, default: null, trim: true, maxlength: 120 },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// MongoDB removes expired challenges in the background; application code still checks the date.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpChallengeSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);

