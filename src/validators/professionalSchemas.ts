import { z } from "../config/openapi.js";

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

export const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .pipe(z.email())
        .openapi({ example: "doctor@example.com" }),
    })
    .strict(),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .min(1)
        .openapi({ example: "9f1c2e...64-hex-chars" }),

      password: z
        .string()
        .min(8)
        .openapi({ example: "newSecurePassword123" }),
    })
    .strict(),
});

export const verifyEmailSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .min(1)
        .openapi({ example: "9f1c2e...64-hex-chars" }),
    })
    .strict(),
});

export const resendVerificationSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .pipe(z.email())
        .openapi({ example: "doctor@example.com" }),
    })
    .strict(),
});