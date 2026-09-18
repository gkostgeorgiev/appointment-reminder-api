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

describe("POST /professionals/refresh rate limiting", () => {
  // Order matters: these share one rate-limit bucket (same app instance, same
  // IP) for the whole file, so the below-threshold case must run before the
  // one that deliberately exhausts it.
  it("returns 401, not 429, for a single invalid refresh attempt", async () => {
    const res = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", "refreshToken=another-bad-token");

    expect(res.status).toBe(401);
  });

  it("429s after enough failed refresh attempts from the same IP", async () => {
    let lastRes;

    for (let i = 0; i < 21; i++) {
      lastRes = await request(app)
        .post("/api/v1/professionals/refresh")
        .set("Cookie", "refreshToken=not-a-real-refresh-token");
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body).toMatchObject({
      ok: false,
      status: 429,
      message: "Too many refresh attempts, please try again later.",
    });
  });
});

describe("POST /professionals/login rate limiting", () => {
  // Order matters here too: loginIpLimiter (max 20) and loginEmailLimiter
  // (max 5) share the route, but each has its own independent bucket - the
  // IP bucket accumulates across every request in this describe block
  // regardless of which email is used, so the email-keyed case (small,
  // fixed volume) runs first, leaving plenty of headroom for the IP-keyed
  // case (larger volume, unique emails) to push the shared IP bucket over
  // its own threshold afterward.
  it("429s the email-keyed limiter after repeated failed attempts against the same email", async () => {
    let lastRes;

    for (let i = 0; i < 6; i++) {
      lastRes = await request(app)
        .post("/api/v1/professionals/login")
        .send({ email: "ratelimit-login@example.com", password: "wrong-password" });
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body).toMatchObject({
      ok: false,
      status: 429,
      message: "Too many login attempts. Please try again later.",
    });
  });

  it("429s the IP-keyed limiter after repeated failed attempts across many distinct emails", async () => {
    let lastRes;

    for (let i = 0; i < 25; i++) {
      lastRes = await request(app)
        .post("/api/v1/professionals/login")
        .send({
          email: `ratelimit-login-ip-${i}@example.com`,
          password: "wrong-password",
        });
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body).toMatchObject({
      ok: false,
      status: 429,
      message: "Too many login attempts. Please try again later.",
    });
  });
});

describe("POST /professionals/forgot-password rate limiting", () => {
  it("429s after enough requests from the same IP", async () => {
    let lastRes;

    for (let i = 0; i < 6; i++) {
      lastRes = await request(app)
        .post("/api/v1/professionals/forgot-password")
        .send({ email: "ratelimit-forgot@example.com" });
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body).toMatchObject({
      ok: false,
      status: 429,
      message: "Too many password reset requests. Please try again later.",
    });
  });
});

describe("POST /professionals/resend-verification rate limiting", () => {
  it("429s after enough requests from the same IP", async () => {
    let lastRes;

    for (let i = 0; i < 6; i++) {
      lastRes = await request(app)
        .post("/api/v1/professionals/resend-verification")
        .send({ email: "ratelimit-resend@example.com" });
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body).toMatchObject({
      ok: false,
      status: 429,
      message: "Too many verification email requests. Please try again later.",
    });
  });
});
