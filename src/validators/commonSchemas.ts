import { z } from "../config/openapi.js";
import mongoose from "mongoose";

export const objectIdParam = (paramName: string, entityName: string) =>
  z.object({
    [paramName]: objectIdSchema(entityName),
  });

export const objectIdSchema = (entityName: string) =>
  z
    .string()
    .trim()
    .openapi({ example: "65f1b9e9d02c9a0012c5c9a1" })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: `Invalid ${entityName} id`,
    });

export const paginationQuerySchema = (defaultLimit: number, maxLimit: number) => ({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .openapi({ example: 1 }),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(maxLimit)
    .optional()
    .default(defaultLimit)
    .openapi({ example: defaultLimit }),
});