import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { scrub } from "../utils/scrub.js";

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
    logger.info("SENTRY_DSN not set, error reporting disabled");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    beforeSend,
  });

  logger.info("Sentry error reporting initialized");
};
