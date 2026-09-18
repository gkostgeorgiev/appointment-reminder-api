import * as Sentry from "@sentry/node";
import fs from "fs";
import https from "https";
import path from "path";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { initSentry } from "./config/sentry.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { logger } from "./config/logger.js";
import { startReminderJob } from "./jobs/reminderJob.js";

initSentry();

// Connect database
await connectDB();

const PORT = env.PORT;

const onListen = () => {
  logger.info(
    { port: PORT, env: env.NODE_ENV },
    "Server running",
  );
  if (env.NODE_ENV !== "test" && env.RUN_REMINDER_WORKER) {
    startReminderJob();
  }
};

// SameSite=None cookies require HTTPS, so dev serves over a locally-trusted
// cert (see README) to exercise the same cookie path production runs behind
// Render's proxy termination.
const devCertPath = path.resolve(process.cwd(), "certs", "dev-cert.pem");
const devKeyPath = path.resolve(process.cwd(), "certs", "dev-key.pem");

const server =
  env.NODE_ENV === "development" &&
  fs.existsSync(devCertPath) &&
  fs.existsSync(devKeyPath)
    ? https
        .createServer(
          {
            cert: fs.readFileSync(devCertPath),
            key: fs.readFileSync(devKeyPath),
          },
          app,
        )
        .listen(PORT, onListen)
    : app.listen(PORT, onListen);

const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down gracefully");

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
    }

    try {
      await disconnectDB();
    } catch (dbError) {
      logger.error({ err: dbError }, "Error closing MongoDB connection");
    }

    clearTimeout(forceExitTimer);
    process.exit(err ? 1 : 0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  Sentry.captureException(err);
  // captureException only queues the event; wait (bounded) for it to actually
  // reach Sentry before shutdown() proceeds to process.exit().
  Sentry.flush(2000).finally(() => shutdown("uncaughtException"));
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
  Sentry.captureException(reason);
  Sentry.flush(2000).finally(() => shutdown("unhandledRejection"));
});
