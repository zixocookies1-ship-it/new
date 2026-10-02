import { Schema, model, models, type Model, type Types } from 'mongoose';

export const USER_ROLES = ['ADMIN', 'EDITOR', 'SUPPORT'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  /** Brute-force protection for the login form. */
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      // Uniqueness is declared once, in UserSchema.index() below.
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: 'EDITOR', index: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

UserSchema.index({ email: 1 }, { unique: true });

/** Never leak the hash through any API response. */
UserSchema.set('toJSON', {
  virtuals: true,
  transform: ((_doc: unknown, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    delete ret.__v;
    return ret;
  }) as unknown as (doc: unknown, ret: unknown) => unknown,
});

export const User = (models.User as Model<UserDoc>) || model<UserDoc>('User', UserSchema);
