import mongoose from "mongoose";
import { env } from "./env.js";

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

export { connectDB, disconnectDB };
