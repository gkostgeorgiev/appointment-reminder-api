import { z } from "zod";

export const updateCustomerSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().min(1).optional(),
      phone: z.string().trim().min(1).optional(),
      email: z.string().trim().pipe(z.string().email()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});
