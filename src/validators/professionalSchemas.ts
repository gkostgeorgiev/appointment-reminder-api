import { z } from "zod";

export const registerProfessionalSchema = z.object({
  body: z
    .object({
      email: z.string().trim().pipe(z.email()),
      password: z.string().min(8),
      profession: z.string().min(1).optional(),
    })
    .strict(),
});

export const loginProfessionalSchema = z.object({
  body: z
    .object({
      email: z.string().trim().pipe(z.email()),
      password: z.string().min(8),
    })
    .strict(),
});
