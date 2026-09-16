import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp, clearDatabase } from "../helpers/setup.js";
import { registerAndLogin } from "../helpers/auth.js";

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

const newCustomerPayload = (phone: string) => ({
  firstName: "Maria",
  lastName: "Ivanova",
  phone,
});

describe("auth + CSRF flow", () => {
  it("allows a cookie-authenticated mutating request with the correct CSRF header", async () => {
    const pro = await registerAndLogin(app, "csrf1@example.com");

    const res = await request(app)
      .post("/api/v1/customers")
      .set("Cookie", pro.cookieHeader)
      .set("x-csrf-token", pro.csrfToken!)
      .send(newCustomerPayload("359888200001"));

    expect(res.status).toBe(201);
  });

  it("rejects a cookie-authenticated mutating request with a missing CSRF header", async () => {
    const pro = await registerAndLogin(app, "csrf2@example.com");

    const res = await request(app)
      .post("/api/v1/customers")
      .set("Cookie", pro.cookieHeader)
      .send(newCustomerPayload("359888200002"));

    expect(res.status).toBe(403);
  });

  it("rejects a cookie-authenticated mutating request with a wrong CSRF header value", async () => {
    const pro = await registerAndLogin(app, "csrf3@example.com");

    const res = await request(app)
      .post("/api/v1/customers")
      .set("Cookie", pro.cookieHeader)
      .set("x-csrf-token", "not-the-real-token")
      .send(newCustomerPayload("359888200003"));

    expect(res.status).toBe(403);
  });

  it("allows a cookie-authenticated safe (GET) request with no CSRF header at all", async () => {
    const pro = await registerAndLogin(app, "csrf4@example.com");

    const res = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", pro.cookieHeader);

    expect(res.status).toBe(200);
  });

  it("rejects a garbage/invalid token cookie", async () => {
    const res = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", "token=not-a-real-jwt");

    expect(res.status).toBe(401);
  });

  it("rejects a request with no token at all", async () => {
    const res = await request(app).get("/api/v1/customers");

    expect(res.status).toBe(401);
  });

  it("rejects a token issued before the account's password was changed", async () => {
    const pro = await registerAndLogin(app, "csrf6@example.com");

    // Directly bump passwordChangedAt into the future to simulate a password
    // change that happened after this token's `iat`, bypassing the pre-save
    // hashing hook since we only want to move the timestamp, not the password.
    const { Professional } = await import("../../src/models/Professional.js");
    await Professional.updateOne(
      { email: "csrf6@example.com" },
      { $set: { passwordChangedAt: new Date(Date.now() + 60_000) } },
    );

    const res = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", pro.cookieHeader);

    expect(res.status).toBe(401);
  });
});
