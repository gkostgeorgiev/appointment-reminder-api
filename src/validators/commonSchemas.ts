import { z } from "zod";
import mongoose from "mongoose";

export const objectIdParam = (paramName: string) =>
  z.object({
    params: z
      .object({
        [paramName]: z
          .string()
          .refine((val) => mongoose.Types.ObjectId.isValid(val), {
            message: `Invalid ${paramName}`,
          }),
      })
      .strict(),
  });
