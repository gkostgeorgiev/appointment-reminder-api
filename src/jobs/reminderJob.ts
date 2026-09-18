import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { logger } from "../config/logger.js";
import { Appointment } from "../models/Appointment.js";
import { sendAppointmentReminder } from "../services/reminderService.js";
import { IAppointmentPopulated } from "../models/Appointment.js";

export const MAX_REMINDER_ATTEMPTS = 4;
const RETRY_BACKOFF_MINUTES = [5, 15, 30, 60];
// How long a claim on an appointment lasts before it's treated as abandoned
// (e.g. the process crashed mid-send) and eligible to be claimed again.
const REMINDER_CLAIM_TTL_MS = 5 * 60 * 1000;

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
      reminderClaimedUntil: { $not: { $gt: now } },
      $or: [
        { reminderNextAttemptAt: null },
        { reminderNextAttemptAt: { $lte: now } },
      ],
    })
      .maxTimeMS(10_000)
      .populate("customer", "firstName lastName phone");
  } catch (error) {
    logger.error({ err: error }, "Reminder job tick failed");
    Sentry.captureException(error);
    return;
  }

  for (const appointment of appointments) {
    const populated = appointment as unknown as IAppointmentPopulated;

    // Atomic claim: only proceed if this call is the one that wins the
    // write. An overlapping tick (a slow previous run still in flight, or
    // - if the single-worker deployment invariant is ever violated - a
    // second worker) racing on the same appointment will find nothing left
    // to match and get null back here instead of double-sending.
    const claimed = await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        reminderSent: false,
        reminderClaimedUntil: { $not: { $gt: now } },
      },
      {
        $set: {
          reminderClaimedUntil: new Date(now.getTime() + REMINDER_CLAIM_TTL_MS),
        },
      },
    );

    if (!claimed) {
      continue;
    }

    try {
      await sendAppointmentReminder(populated);

      await Appointment.updateOne(
        { _id: appointment._id, reminderSent: false },
        { $set: { reminderSent: true, reminderClaimedUntil: null } },
      );
    } catch (error) {
      logger.error(
        { err: error, appointmentId: appointment._id.toString() },
        "Reminder failed",
      );
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
            reminderClaimedUntil: null,
          },
        },
      );
    }
  }
};

export const startReminderJob = () => {
  logger.info("Reminder job started");

  cron.schedule("*/5 * * * *", runReminderTick);
};
