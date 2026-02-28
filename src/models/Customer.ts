import { Schema, model, Types, Document } from "mongoose";

export interface ICustomer extends Document {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  professional: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    professional: {
      type: Schema.Types.ObjectId,
      ref: "Professional",
      required: true,
    },
  },
  { timestamps: true }
);

customerSchema.index({ professional: 1 });

export const Customer = model<ICustomer>("Customer", customerSchema);