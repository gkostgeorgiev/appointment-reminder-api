import mongoose from "mongoose";
import { env } from "./env.js";

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
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(
      "Database connection failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
};

export { connectDB, disconnectDB, getDbStatus };
