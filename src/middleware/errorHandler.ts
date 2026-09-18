import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { logger } from "../config/logger.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Server Error";

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 404;
    message = "Resource not found";
  }

  // Duplicate key
  if (err instanceof MongoServerError && err.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value entered";
  }

  // Mongoose validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(", ");
  }

  // Log-level parity with the >= 500 threshold already used for Sentry
  // reporting below, rather than logging every error at the same severity.
  if (statusCode >= 500) {
    logger.error({ requestId: req.requestId, err }, "request error");
    Sentry.captureException(err);
  } else {
    logger.warn({ requestId: req.requestId, err }, "request error");
  }

  res.status(statusCode).json({
    ok: false,
    status: statusCode,
    message,
    requestId: req.requestId,
  });
};
