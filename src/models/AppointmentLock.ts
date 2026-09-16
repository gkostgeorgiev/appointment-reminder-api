import { Schema, model, Types, Document } from "mongoose";

// Not a scheduling entity - a per-professional serialization point.
// hasAppointmentConflict + Appointment insert/update run inside a
// transaction; snapshot isolation alone lets two concurrent transactions
// each see "no conflict" and both commit (write skew). Bumping this shared
// document inside the same transaction forces MongoDB to abort and retry
// whichever one loses the write race, so the retry re-checks against the
// winner's now-committed appointment. See appointment.controller.ts.
export interface IAppointmentLock extends Document {
  professional: Types.ObjectId;
  version: number;
}

const appointmentLockSchema = new Schema<IAppointmentLock>({
  professional: {
    type: Schema.Types.ObjectId,
    ref: "Professional",
    required: true,
    unique: true,
  },
  version: {
    type: Number,
    default: 0,
  },
});

export const AppointmentLock = model<IAppointmentLock>(
  "AppointmentLock",
  appointmentLockSchema,
);
