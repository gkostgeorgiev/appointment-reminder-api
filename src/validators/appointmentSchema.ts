import { z } from "../config/openapi.js";
import { appointmentStatuses } from "../models/Appointment.js";
import { objectIdParam, objectIdSchema } from "./commonSchemas.js";

export const futureDateSchema = z
  .iso
  .datetime()
  .openapi({ example: "2026-04-10T14:30:00Z" })
  .refine((val) => new Date(val) > new Date(), {
    message: "Appointment must be in the future",
  });

export const createAppointmentSchema = z.object({
  body: z
    .object({
      customer: objectIdSchema("customer"),

      start: futureDateSchema,

      duration: z
        .number()
        .int()
        .min(1)
        .openapi({ example: 30 }),

      service: z
        .string()
        .trim()
        .optional()
        .openapi({ example: "Dental cleaning" }),

      notes: z
        .string()
        .trim()
        .optional()
        .openapi({ example: "First visit consultation" }),
    })
    .strict(),
});

export const updateAppointmentSchema = z.object({
  params: objectIdParam("id", "appointment"),

  body: z
    .object({
      customer: objectIdSchema("customer").optional(),

      start: futureDateSchema.optional(),

      duration: z
        .number()
        .int()
        .min(1)
        .optional()
        .openapi({ example: 45 }),

      service: z
        .string()
        .trim()
        .optional()
        .openapi({ example: "Root canal treatment" }),

      notes: z
        .string()
        .trim()
        .optional()
        .openapi({ example: "Patient requested anesthesia" }),

      status: z
        .enum(appointmentStatuses)
        .optional()
        .openapi({ example: "completed" }),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

export const getAppointmentsSchema = z.object({
  query: z
    .object({
      from: z.iso
        .date()
        .optional()
        .openapi({ example: "2026-04-01" }),

      to: z.iso
        .date()
        .optional()
        .openapi({ example: "2026-04-10" }),

      start: z.iso
        .date()
        .optional()
        .openapi({ example: "2026-04-05" }),

      range: z
        .enum(["today", "week", "month"])
        .optional()
        .openapi({ example: "week" }),
    })
    .refine(
      (data) => {
        const filtersUsed =
          Number(!!data.start) +
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