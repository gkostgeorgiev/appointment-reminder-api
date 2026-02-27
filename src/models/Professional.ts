import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IProfessional extends Document {
  email: string;
  password: string;
  profession: string;
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
      default: "dentist",
    },
  },
  {
    timestamps: true,
  }
);

professionalSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
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