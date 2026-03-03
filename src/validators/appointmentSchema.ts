import z from "zod";
import { appointmentStatuses } from "../models/Appointment";
import { objectIdParam, objectIdSchema } from "./commonSchemas";

export const futureDateSchema = z.iso
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
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      date: z.iso.date().optional(),
      range: z.enum(["today", "week", "month"]).optional(),
    })
    .refine(
      (data) => {
        const filtersUsed =
          Number(!!data.date) +
          Number(!!data.range) +
          Number(!!data.from || !!data.to);

        return filtersUsed <= 1;
      },
      {
        message: "Use only one filtering method: date, range, or from/to",
      },
    )
    .refine(
      (data) =>
        !(data.from && data.to) || new Date(data.from) <= new Date(data.to),
      {
        message: "From date must be before To date",
      },
    ),
});
