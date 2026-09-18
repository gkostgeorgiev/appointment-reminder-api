import "dotenv/config";
import { z } from "zod";

const emailFromRegex = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$|^.+<[^\s<>]+@[^\s<>]+\.[^\s<>]+>$/;
const e164Regex = /^\+[1-9]\d{1,14}$/;

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://"),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .refine(
      (origins) => origins.every((origin) => /^https?:\/\/.+/.test(origin)),
      { message: "each comma-separated origin must be a valid http(s) URL" },
    ),
  TWILIO_ACCOUNT_SID: z
    .string()
    .regex(/^AC[a-zA-Z0-9]{32}$/, "must be a Twilio Account SID (starts with AC)"),
  TWILIO_AUTH_TOKEN: z.string().min(32, "must be at least 32 characters"),
  TWILIO_PHONE_NUMBER: z.string().regex(e164Regex, "must be in E.164 format, e.g. +1234567890"),
  RUN_REMINDER_WORKER: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]),
  RESEND_API_KEY: z.string().regex(/^re_/, "must be a Resend API key (starts with re_)"),
  EMAIL_FROM: z
    .string()
    .regex(emailFromRegex, 'must be an email address, e.g. "you@example.com" or "Name <you@example.com>"'),
  FRONTEND_URL: z.string().url(),
  PERSONAL_NUMBER: z
    .string()
    .regex(e164Regex, "must be in E.164 format, e.g. +1234567890")
    .optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Deliberately console.error, not the structured logger (src/config/logger.ts):
  // the logger needs env.NODE_ENV to configure itself, so it can't be used
  // before env parsing has actually succeeded without creating a cycle.
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
