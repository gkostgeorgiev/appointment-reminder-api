import { sendSms } from "./smsService";
import { IAppointmentPopulated } from "../models/Appointment";

export const sendAppointmentReminder = async (appointment: IAppointmentPopulated) => {
  const phone = appointment.customer.phone;

  const start = new Date(appointment.start);

  const message =
    `Напомняне: Имате час утре в ` +
    `${start.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}.`;

  await sendSms(phone, message);
};
