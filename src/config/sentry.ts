import * as Sentry from "@sentry/node";
import { env } from "./env.js";

const PHONE_REGEX = /\+?\d[\d\s().-]{6,}\d/g;
const EMAIL_REGEX = /[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/g;

const scrub = (value: string) =>
  value.replace(EMAIL_REGEX, "[REDACTED_EMAIL]").replace(PHONE_REGEX, "[REDACTED_PHONE]");

const beforeSend: NonNullable<Parameters<typeof Sentry.init>[0]>["beforeSend"] = (event) => {
  if (event.message) {
    event.message = scrub(event.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrub(exception.value);
    }
  }

  return event;
};

export const initSentry = () => {
  if (!env.SENTRY_DSN) {
    console.log("SENTRY_DSN not set, error reporting disabled");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    beforeSend,
  });

  console.log("Sentry error reporting initialized");
};
