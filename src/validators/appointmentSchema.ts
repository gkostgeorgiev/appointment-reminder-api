import z from "zod";
import { appointmentStatuses } from "../models/Appointment";
import { objectIdParam, objectIdSchema } from "./commonSchemas";

export const futureDateSchema = z
  .iso
  .datetime()
  .refine((val) => new Date(val) > new Date(), {
    message: "Appointment must be in the future",
  });

export const createAppointmentSchema = z.object({
  body: z
    .object({
      customer: objectIdSchema("customer"),

      date: futureDateSchema,
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
      date: futureDateSchema.optional(),
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

export const getAppointmentsSchema = z.object({
  query: z
    .object({
      start: z.iso.datetime().optional(),
      end: z.iso.datetime().optional(),
    })
    .refine(
      (data) =>
        !(data.start && data.end) ||
        new Date(data.start) <= new Date(data.end),
      {
        message: "Start date must be before end date",
      }
    ),
});