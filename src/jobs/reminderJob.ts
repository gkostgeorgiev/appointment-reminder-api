import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { Appointment } from "../models/Appointment.js";
import { sendAppointmentReminder } from "../services/reminderService.js";
import { IAppointmentPopulated } from "../models/Appointment.js";

export const MAX_REMINDER_ATTEMPTS = 4;
const RETRY_BACKOFF_MINUTES = [5, 15, 30, 60];

const backoffMinutes = (attempts: number) =>
  RETRY_BACKOFF_MINUTES[Math.min(attempts, RETRY_BACKOFF_MINUTES.length) - 1];

export const runReminderTick = async () => {
  const now = new Date();

  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  let appointments;

  try {
    appointments = await Appointment.find({
      start: { $gte: from, $lte: to },
      reminderSent: false,
      status: "scheduled",
      reminderAttempts: { $lt: MAX_REMINDER_ATTEMPTS },
      $or: [
        { reminderNextAttemptAt: null },
        { reminderNextAttemptAt: { $lte: now } },
      ],
    }).populate("customer", "firstName lastName phone");
  } catch (error) {
    console.error("Reminder job tick failed:", error);
    Sentry.captureException(error);
    return;
  }

  for (const appointment of appointments) {
    const populated = appointment as unknown as IAppointmentPopulated;

    try {
      await sendAppointmentReminder(populated);

      await Appointment.updateOne(
        { _id: appointment._id, reminderSent: false },
        { $set: { reminderSent: true } },
      );
    } catch (error) {
      console.error("Reminder failed:", error);
      Sentry.captureException(error);

      const attempts = appointment.reminderAttempts + 1;
      const gaveUp = attempts >= MAX_REMINDER_ATTEMPTS;

      if (gaveUp) {
        Sentry.captureMessage(
          `Reminder permanently failed after ${attempts} attempts`,
          {
            level: "error",
            extra: { appointmentId: appointment._id.toString() },
          },
        );
      }

      await Appointment.updateOne(
        { _id: appointment._id, reminderSent: false },
        {
          $set: {
            reminderAttempts: attempts,
            reminderNextAttemptAt: gaveUp
              ? null
              : new Date(now.getTime() + backoffMinutes(attempts) * 60_000),
          },
        },
      );
    }
  }
};

export const startReminderJob = () => {
  console.log("Reminder job started");

  cron.schedule("*/5 * * * *", runReminderTick);
};
