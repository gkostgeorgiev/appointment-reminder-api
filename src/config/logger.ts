import pino from "pino";
import { env } from "./env.js";
import { scrub } from "../utils/scrub.js";

const errSerializer = (err: unknown) => {
  if (!(err instanceof Error)) {
    return typeof err === "string" ? scrub(err) : err;
  }

  const serialized = pino.stdSerializers.err(err);
  serialized.message = scrub(serialized.message);
  if (serialized.stack) {
    serialized.stack = scrub(serialized.stack);
  }

  return serialized;
};

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  serializers: { err: errSerializer },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
