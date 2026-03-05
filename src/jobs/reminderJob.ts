import cron from "node-cron";
import { Appointment } from "../models/Appointment.js";
import { sendAppointmentReminder } from "../services/reminderService.js";
import { IAppointmentPopulated } from "../models/Appointment.js";

export const startReminderJob = () => {
  console.log("Reminder job started");

  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();

    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const appointments = await Appointment.find({
      start: { $gte: from, $lte: to },
      reminderSent: false,
      status: "scheduled",
    }).populate("customer", "firstName lastName phone");

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
      }
    }
  });
};
