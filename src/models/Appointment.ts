import { Schema, model, Types, Document } from "mongoose";

const appointmentStatuses = [
  "scheduled",
  "completed",
  "cancelled",
  "no-show",
] as const;

export interface IAppointment extends Document {
  professional: Types.ObjectId;
  customer: Types.ObjectId;

  date: Date;
  duration: number;

  service?: string;
  notes?: string;

  status: (typeof appointmentStatuses)[number];

  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema(
  {
    professional: {
      type: Types.ObjectId,
      ref: "Professional",
      required: true,
    },
    customer: {
      type: Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    service: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: appointmentStatuses,
      default: "scheduled",
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ professional: 1, date: 1 });

export const Appointment = model<IAppointment>(
  "Appointment",
  appointmentSchema,
);
