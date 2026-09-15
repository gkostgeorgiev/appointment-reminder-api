import { z } from "../config/openapi.js";
import { objectIdParam, paginationQuerySchema } from "./commonSchemas.js";

export const createCustomerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .trim()
        .min(1)
        .openapi({ example: "Maria" }),

      lastName: z
        .string()
        .trim()
        .min(1)
        .openapi({ example: "Ivanova" }),

      phone: z
        .string()
        .trim()
        .min(1)
        .openapi({ example: "359888123456" }),

      email: z
        .string()
        .trim()
        .pipe(z.email())
        .optional()
        .openapi({ example: "maria@example.com" }),
    })
    .strict(),
});

export const updateCustomerSchema = z.object({
  params: objectIdParam("id", "customer"),

  body: z
    .object({
      firstName: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({ example: "Maria" }),

      lastName: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({ example: "Ivanova" }),

      phone: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({ example: "+359888123456" }),

      email: z
        .string()
        .trim()
        .pipe(z.email())
        .optional()
        .openapi({ example: "maria@example.com" }),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const deleteCustomerSchema = z.object({
  params: objectIdParam("id", "customer"),
});

export const getCustomersSchema = z.object({
  query: z
    .object({
      phone: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({ example: "888" }),
      name: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({ example: "John" }),

      ...paginationQuerySchema(50, 200),
    })
    .strict(),
});