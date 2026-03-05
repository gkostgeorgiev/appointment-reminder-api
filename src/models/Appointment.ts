import { Document, model, Schema, Types } from "mongoose";
import { ICustomer } from "./Customer";

export const appointmentStatuses = [
  "scheduled",
  "completed",
  "cancelled",
  "no-show",
] as const;

export interface IAppointment extends Document {
  professional: Types.ObjectId;
  customer: Types.ObjectId;

  start: Date;
  duration: number;

  service?: string;
  notes?: string;

  status: (typeof appointmentStatuses)[number];

  reminderSent: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAppointmentPopulated extends Document {
  professional: Types.ObjectId;
  customer: ICustomer;

  start: Date;
  duration: number;

  service?: string;
  notes?: string;

  status: (typeof appointmentStatuses)[number];

  reminderSent: boolean;

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
    start: {
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
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ professional: 1, start: 1, reminderSent: 1 });

export const Appointment = model<IAppointment>(
  "Appointment",
  appointmentSchema,
);
