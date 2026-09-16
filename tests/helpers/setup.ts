import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Express } from "express";
import { setTestEnv } from "./testEnv.js";

// A single-node replica set, not a standalone instance: appointment
// creation/update uses multi-document transactions (see
// appointment.controller.ts's withSchedulingLock), which MongoDB only
// supports against a replica set - same as production, which runs on
// Atlas (always a replica set, even on the free/shared tier).
export const setupTestApp = async (): Promise<{
  app: Express;
  mongod: MongoMemoryReplSet;
}> => {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  setTestEnv(mongod.getUri());

  const { connectDB } = await import("../../src/config/db.js");
  await connectDB();

  const { app } = await import("../../src/app.js");

  return { app, mongod };
};

export const teardownTestApp = async (mongod: MongoMemoryReplSet) => {
  const { disconnectDB } = await import("../../src/config/db.js");
  await disconnectDB();
  await mongod.stop();
};

export const clearDatabase = async () => {
  await mongoose.connection.db?.dropDatabase();
};
