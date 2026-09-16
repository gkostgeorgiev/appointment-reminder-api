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
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

let app: Express;
let mongod: MongoMemoryReplSet;
let sendVerificationEmailMock: ReturnType<typeof vi.fn>;
let sendPasswordResetEmailMock: ReturnType<typeof vi.fn>;
let sentry: { captureException: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  ({ app, mongod } = await setupTestApp());
  ({ sendVerificationEmail: sendVerificationEmailMock } = await import(
    "../../src/services/emailService.js"
  ));
  ({ sendPasswordResetEmail: sendPasswordResetEmailMock } = await import(
    "../../src/services/emailService.js"
  ));
  sentry = await import("@sentry/node");
});

afterEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

describe("email delivery failures stay invisible to the client but reach Sentry", () => {
  it("register: still creates the account and returns 201 when the verification email fails to send", async () => {
    sendVerificationEmailMock.mockRejectedValueOnce(new Error("Resend rejected"));

    const res = await request(app)
      .post("/api/v1/professionals/register")
      .send({ email: "sendfail-register@example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("sendfail-register@example.com");
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("forgot-password: still responds with the generic 200 message when the reset email fails to send", async () => {
    const email = "sendfail-reset@example.com";
    sendVerificationEmailMock.mockResolvedValueOnce(undefined);
    await registerAndLogin(app, email);

    sendPasswordResetEmailMock.mockRejectedValueOnce(new Error("Resend rejected"));

    const res = await request(app)
      .post("/api/v1/professionals/forgot-password")
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(
      "If an account with that email exists, a password reset link has been sent.",
    );
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("forgot-password: identical response for a non-existent account, and no send is attempted", async () => {
    const res = await request(app)
      .post("/api/v1/professionals/forgot-password")
      .send({ email: "no-such-account@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(
      "If an account with that email exists, a password reset link has been sent.",
    );
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("resend-verification: still responds with the generic 200 message when the email fails to send", async () => {
    const email = "sendfail-resend@example.com";
    sendVerificationEmailMock.mockResolvedValueOnce(undefined);
    await request(app)
      .post("/api/v1/professionals/register")
      .send({ email, password: TEST_PASSWORD });

    sendVerificationEmailMock.mockRejectedValueOnce(new Error("Resend rejected"));

    const res = await request(app)
      .post("/api/v1/professionals/resend-verification")
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(
      "If an account with that email exists and is not yet verified, a verification link has been sent.",
    );
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
