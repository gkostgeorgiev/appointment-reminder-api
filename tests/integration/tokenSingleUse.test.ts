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
import { registerAndLogin, TEST_PASSWORD } from "../helpers/auth.js";

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
  vi.clearAllMocks();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

describe("password reset token single-use", () => {
  it("only lets one of two concurrent reset requests with the same token succeed", async () => {
    const email = "reset-race@example.com";
    await registerAndLogin(app, email);

    await request(app)
      .post("/api/v1/professionals/forgot-password")
      .send({ email });

    const { sendPasswordResetEmail } = await import(
      "../../src/services/emailService.js"
    );
    const rawResetToken = vi.mocked(sendPasswordResetEmail).mock
      .calls[0][1] as string;

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/v1/professionals/reset-password")
        .send({ token: rawResetToken, password: "RaceWinner123!" }),
      request(app)
        .post("/api/v1/professionals/reset-password")
        .send({ token: rawResetToken, password: "RaceLoser123!" }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);

    // Only the winning password actually took effect.
    const winningPassword = first.status === 200 ? "RaceWinner123!" : "RaceLoser123!";
    const loginRes = await request(app)
      .post("/api/v1/professionals/login")
      .send({ email, password: winningPassword });
    expect(loginRes.status).toBe(200);
  });
});

describe("email verification token single-use", () => {
  it("only lets one of two concurrent verify requests with the same token succeed", async () => {
    const email = "verify-race@example.com";

    const registerRes = await request(app)
      .post("/api/v1/professionals/register")
      .send({ email, password: TEST_PASSWORD });
    const rawToken = registerRes.body.data.verificationToken as string;
    expect(rawToken).toBeTruthy();

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/v1/professionals/verify-email")
        .send({ token: rawToken }),
      request(app)
        .post("/api/v1/professionals/verify-email")
        .send({ token: rawToken }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });
});
