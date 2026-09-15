import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Express } from "express";
import { setTestEnv } from "./testEnv.js";

export const setupTestApp = async (): Promise<{
  app: Express;
  mongod: MongoMemoryServer;
}> => {
  const mongod = await MongoMemoryServer.create();
  setTestEnv(mongod.getUri());

  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  const { app } = await import("../../src/app.js");

  return { app, mongod };
};

export const teardownTestApp = async (mongod: MongoMemoryServer) => {
  const { disconnectDB } = await import("../../src/config/db.js");
  await disconnectDB();
  await mongod.stop();
};

export const clearDatabase = async () => {
  await mongoose.connection.db?.dropDatabase();
};
