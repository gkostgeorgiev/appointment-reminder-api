import { Schema, model, Document } from "mongoose";

// Singleton document (fixed _id) that reminderJob.ts uses as a leader-election
// lease: only the instance currently holding it runs a given tick's work.
// This is what actually prevents duplicate ticking if RUN_REMINDER_WORKER is
// ever left on for more than one instance by mistake (see issue #23) - the
// per-appointment reminderClaimedUntil lease in reminderJob.ts already stops
// a double send, but without this, every instance still queries and
// contends on every tick. Not a scheduling entity, and unrelated to
// AppointmentLock (which serializes appointment create/update per
// professional).
export const REMINDER_WORKER_LOCK_ID = "reminder-worker";

export interface IReminderWorkerLock extends Document<string> {
  holder: string;
  expiresAt: Date;
}

const reminderWorkerLockSchema = new Schema<IReminderWorkerLock>({
  _id: { type: String, required: true },
  holder: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

export const ReminderWorkerLock = model<IReminderWorkerLock>(
  "ReminderWorkerLock",
  reminderWorkerLockSchema,
);
