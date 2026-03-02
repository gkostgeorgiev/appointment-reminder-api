import z from "zod";
import { appointmentStatuses } from "../models/Appointment";
import { objectIdParam, objectIdSchema } from "./commonSchemas";

export const createAppointmentSchema = z.object({
  body: z
    .object({
      customer: objectIdSchema("customer"),

      date: z.iso.datetime().refine((val) => new Date(val) > new Date(), {
        message: "Appointment must be in the future",
      }),
      duration: z.number().int().min(1),

      service: z.string().trim().optional(),
      notes: z.string().trim().optional(),
    })
    .strict(),
});

export const updateAppointmentSchema = z.object({
  params: objectIdParam("id", "appointment"),

  body: z
    .object({
      customer: objectIdSchema("customer").optional(),
      date: z.iso.datetime().optional(),
      duration: z.number().int().min(1).optional(),
      service: z.string().trim().optional(),
      notes: z.string().trim().optional(),
      status: z.enum(appointmentStatuses).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});
