import { sendSms } from "./smsService.js";
import { IAppointmentPopulated } from "../models/Appointment.js";

export const sendAppointmentReminder = async (appointment: IAppointmentPopulated) => {
  const phone = appointment.customer.phone;

  const start = new Date(appointment.start);

  const message =
    `Напомняне: Имате час утре в ` +
    `${start.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}.`;

  await sendSms(phone, message);
};
