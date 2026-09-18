import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

const READY_STATE_LABELS: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const getDbStatus = () => {
  const state = mongoose.connection.readyState;

  return {
    connected: state === 1,
    state: READY_STATE_LABELS[state] ?? "unknown",
  };
};

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info("MongoDB Connected");
  } catch (error) {
    logger.error({ err: error }, "Database connection failed");
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
};

export { connectDB, disconnectDB, getDbStatus };
