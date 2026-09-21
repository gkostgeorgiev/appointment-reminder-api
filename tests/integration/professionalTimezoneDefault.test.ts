import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp, clearDatabase } from "../helpers/setup.js";
import { TEST_PASSWORD } from "../helpers/auth.js";

vi.mock("../../src/services/smsService.js", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/services/emailService.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let app: Express;
let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  ({ app, mongod } = await setupTestApp());
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

describe("Professional.timezone default", () => {
  it("defaults a newly registered professional's timezone to Europe/Sofia", async () => {
    const email = "tz1@example.com";
    await request(app)
      .post("/api/v1/professionals/register")
      .send({ email, password: TEST_PASSWORD });

    const { Professional } = await import("../../src/models/Professional.js");
    const professional = await Professional.findOne({ email });

    expect(professional?.timezone).toBe("Europe/Sofia");
  });
});
