import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IProfessional extends Document {
  email: string;
  password: string;
  profession: string;
  passwordChangedAt?: Date;
  passwordResetTokenHash?: string | null;
  passwordResetTokenExpires?: Date | null;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationTokenExpires?: Date | null;
  refreshTokenHash?: string | null;
  refreshTokenExpires?: Date | null;
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const professionalSchema = new Schema<IProfessional>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profession: {
      type: String,
      required: true,
      default: "professional",
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
      index: true,
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: null,
      index: true,
    },
    emailVerificationTokenExpires: {
      type: Date,
      select: false,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
      index: true,
    },
    refreshTokenExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

professionalSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  this.refreshTokenHash = null;
  this.refreshTokenExpires = null;
});

professionalSchema.methods.comparePassword = async function (
  candidate: string
) {
  return bcrypt.compare(candidate, this.password);
};

export const Professional = model<IProfessional>(
  "Professional",
  professionalSchema
);
