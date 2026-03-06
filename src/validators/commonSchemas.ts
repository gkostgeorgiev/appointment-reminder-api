import { z } from "../config/openapi";
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