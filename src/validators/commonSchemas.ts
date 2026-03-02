import { z } from "zod";
import mongoose from "mongoose";

export const objectIdParam = (paramName: string, entityName: string) =>
  z.object({
    [paramName]: objectIdSchema(entityName),
  });

export const objectIdSchema = (entityName: string) =>
  z
    .string()
    .trim()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: `Invalid ${entityName} id`,
    });
