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

  it("does not reject a token issued later in the same wall-clock second as a password change (issue #11)", async () => {
    const pro = await registerAndLogin(app, "csrf7@example.com");

    const jwt = await import("jsonwebtoken");
    const { env } = await import("../../src/config/env.js");
    const { Professional } = await import("../../src/models/Professional.js");

    // Both timestamps land in the same integer second, with the password
    // change first (ms 200) and the token issued after it (ms 700). A naive
    // `iat`-based check floors the token's issue time down to the start of
    // that second (ms 0), which lands *before* passwordChangedAt and would
    // wrongly reject a token that was genuinely issued after the change -
    // exactly the false positive issue #11 describes. The `iatMs` claim
    // preserves millisecond precision so this comparison is correct instead.
    const secondStart = Math.floor(Date.now() / 1000) * 1000;
    const passwordChangedAtMs = secondStart + 200;
    const iatMs = secondStart + 700;

    const professional = await Professional.findOne({ email: "csrf7@example.com" });
    await Professional.updateOne(
      { email: "csrf7@example.com" },
      { $set: { passwordChangedAt: new Date(passwordChangedAtMs) } },
    );

    const token = jwt.default.sign(
      {
        userId: professional!.id,
        email: professional!.email,
        iatMs,
        iat: Math.floor(iatMs / 1000),
      },
      env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    const res = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", [`token=${token}`, `csrfToken=${pro.csrfToken}`].join("; "));

    expect(res.status).toBe(200);
  });
});
