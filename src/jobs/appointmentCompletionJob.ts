import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { logger } from "../config/logger.js";
import { Appointment } from "../models/Appointment.js";

export const runAppointmentCompletionTick = async () => {
  const now = new Date();

  try {
    await Appointment.updateMany(
      {
        status: "scheduled",
        start: { $lte: now },
        $expr: {
          $lte: [
            { $add: ["$start", { $multiply: ["$duration", 60000] }] },
            now,
          ],
        },
      },
      { $set: { status: "completed" } },
    ).maxTimeMS(10_000);
  } catch (error) {
    logger.error({ err: error }, "Appointment completion tick failed");
    Sentry.captureException(error);
  }
};

export const startAppointmentCompletionJob = () => {
  logger.info("Appointment completion job started");

  cron.schedule("*/5 * * * *", runAppointmentCompletionTick);
};
