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
