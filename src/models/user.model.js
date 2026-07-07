import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    workEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    personalEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    profilePhotoUrl: { type: String, default: null, maxlength: 2_048 },
    company: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      domain: { type: String, required: true, lowercase: true, trim: true },
    },
    jobTitle: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    industry: { type: String, required: true, trim: true, maxlength: 80 },
    careerLevel: {
      type: String,
      required: true,
      enum: ['Entry', 'Associate', 'Manager', 'Senior', 'Lead', 'Executive', 'Founder'],
    },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    shortBio: { type: String, required: true, trim: true, minlength: 18, maxlength: 500 },
    linkedinUrl: { type: String, required: true, trim: true, maxlength: 2_048 },
    professionalInterests: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      validate: [(items) => items.length >= 2 && items.length <= 12, 'Select 2 to 12 interests'],
    },
    lookingFor: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      validate: [(items) => items.length >= 1 && items.length <= 7, 'Select 1 to 7 goals'],
    },
    trustBadges: {
      type: [String],
      default: ['Verified Employee', 'Company Verified', 'Profile Completed'],
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
    },
    emailVerifiedAt: { type: Date, required: true },
    profileCompletedAt: { type: Date, required: true },
    passwordChangedAt: { type: Date, required: true },
    lastLoginAt: { type: Date, default: null },
    // Incrementing this value invalidates all existing access tokens immediately.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  versionKey: false,
  transform(_document, value) {
    value.id = value._id.toString();
    delete value._id;
    delete value.passwordHash;
    delete value.tokenVersion;
    return value;
  },
});

export const User = mongoose.model('User', userSchema);

