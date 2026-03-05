import { sendSms } from "./smsService";
import { IAppointment } from "../models/Appointment";

export const sendAppointmentReminder = async (appointment: IAppointment) => {
  const phone = appointment.customer.phone;

  const start = new Date(appointment.start);

  const message =
    `Напомняне: Имате час утре в ` +
    `${start.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}.`;

  await sendSms(phone, message);
};
