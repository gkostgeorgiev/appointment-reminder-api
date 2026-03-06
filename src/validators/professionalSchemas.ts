import { z } from "../config/openapi";

export const registerProfessionalSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .pipe(z.email())
        .openapi({ example: "doctor@example.com" }),

      password: z
        .string()
        .min(8)
        .openapi({ example: "securePassword123" }),

      profession: z
        .string()
        .min(1)
        .optional()
        .openapi({ example: "Dentist" }),
    })
    .strict(),
});

export const loginProfessionalSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .pipe(z.email())
        .openapi({ example: "doctor@example.com" }),

      password: z
        .string()
        .min(8)
        .openapi({ example: "securePassword123" }),
    })
    .strict(),
});