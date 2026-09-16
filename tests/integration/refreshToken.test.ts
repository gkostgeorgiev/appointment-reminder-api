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
import { registerAndLogin, extractCookieValue } from "../helpers/auth.js";

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

describe("refresh token flow", () => {
  it("exchanges a valid refresh cookie for a new, working access token", async () => {
    const pro = await registerAndLogin(app, "refresh1@example.com");

    const refreshRes = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data).toBeUndefined();

    const setCookies = refreshRes.headers["set-cookie"] as unknown as
      | string[]
      | undefined;
    const newToken = extractCookieValue(setCookies, "token");
    const newRefreshToken = extractCookieValue(setCookies, "refreshToken");
    expect(newToken).toBeTruthy();
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(pro.refreshToken);

    const meRes = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", `token=${newToken}`);

    expect(meRes.status).toBe(200);
  });

  it("rejects a refresh request with no refresh cookie", async () => {
    const res = await request(app).post("/api/v1/professionals/refresh");

    expect(res.status).toBe(401);
  });

  it("rejects a refresh token that has already been used (rotation)", async () => {
    const pro = await registerAndLogin(app, "refresh2@example.com");

    const first = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);
    expect(second.status).toBe(401);
  });

  it("rejects the refresh cookie after logout", async () => {
    const pro = await registerAndLogin(app, "refresh3@example.com");

    const logoutRes = await request(app)
      .post("/api/v1/professionals/logout")
      .set("Cookie", pro.cookieHeader)
      .set("x-csrf-token", pro.csrfToken!);
    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);

    expect(refreshRes.status).toBe(401);
  });

  it("only lets one of two truly concurrent refresh requests succeed", async () => {
    const pro = await registerAndLogin(app, "refresh5@example.com");

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/v1/professionals/refresh")
        .set("Cookie", `refreshToken=${pro.refreshToken}`),
      request(app)
        .post("/api/v1/professionals/refresh")
        .set("Cookie", `refreshToken=${pro.refreshToken}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it("rejects the refresh cookie after a password reset", async () => {
    const pro = await registerAndLogin(app, "refresh4@example.com");

    await request(app)
      .post("/api/v1/professionals/forgot-password")
      .send({ email: "refresh4@example.com" });

    const { sendPasswordResetEmail } = await import(
      "../../src/services/emailService.js"
    );
    const rawResetToken = vi.mocked(sendPasswordResetEmail).mock
      .calls[0][1] as string;

    const resetRes = await request(app)
      .post("/api/v1/professionals/reset-password")
      .send({ token: rawResetToken, password: "NewPassword123!" });
    expect(resetRes.status).toBe(200);

    const refreshRes = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);

    expect(refreshRes.status).toBe(401);
  });
});
