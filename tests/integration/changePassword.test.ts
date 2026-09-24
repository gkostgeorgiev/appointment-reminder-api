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
import { registerAndLogin, extractCookieValue, TEST_PASSWORD } from "../helpers/auth.js";

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

describe("POST /professionals/change-password", () => {
  it("changes the password, re-issues cookies, and keeps the caller logged in", async () => {
    const pro = await registerAndLogin(app, "changepw1@example.com");

    const res = await pro.authed.post("/api/v1/professionals/change-password").send({
      currentPassword: TEST_PASSWORD,
      newPassword: "NewPassword123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBeTruthy();

    const setCookies = res.headers["set-cookie"] as unknown as string[] | undefined;
    const newToken = extractCookieValue(setCookies, "token");
    const newCsrfToken = extractCookieValue(setCookies, "csrfToken");
    const newRefreshToken = extractCookieValue(setCookies, "refreshToken");
    expect(newToken).toBeTruthy();
    expect(newCsrfToken).toBeTruthy();
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(pro.refreshToken);

    // The new access token is immediately usable, without a re-login.
    const meRes = await request(app)
      .get("/api/v1/customers")
      .set("Cookie", [`token=${newToken}`, `csrfToken=${newCsrfToken}`].join("; "));
    expect(meRes.status).toBe(200);

    // The old refresh token is dead - the hook nulls it out on password change.
    const refreshRes = await request(app)
      .post("/api/v1/professionals/refresh")
      .set("Cookie", `refreshToken=${pro.refreshToken}`);
    expect(refreshRes.status).toBe(401);

    // The new password logs in; the old one no longer does.
    const loginNew = await request(app)
      .post("/api/v1/professionals/login")
      .send({ email: "changepw1@example.com", password: "NewPassword123!" });
    expect(loginNew.status).toBe(200);

    const loginOld = await request(app)
      .post("/api/v1/professionals/login")
      .send({ email: "changepw1@example.com", password: TEST_PASSWORD });
    expect(loginOld.status).toBe(401);
  });

  it("rejects a wrong currentPassword with 401 and leaves the password unchanged", async () => {
    const pro = await registerAndLogin(app, "changepw2@example.com");

    const res = await pro.authed.post("/api/v1/professionals/change-password").send({
      currentPassword: "totally-wrong-password",
      newPassword: "NewPassword123!",
    });

    expect(res.status).toBe(401);

    const loginRes = await request(app)
      .post("/api/v1/professionals/login")
      .send({ email: "changepw2@example.com", password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  it("rejects a newPassword identical to currentPassword with 400", async () => {
    const pro = await registerAndLogin(app, "changepw3@example.com");

    const res = await pro.authed.post("/api/v1/professionals/change-password").send({
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
    });

    expect(res.status).toBe(400);
  });

  it("rejects a newPassword shorter than 8 characters with 400", async () => {
    const pro = await registerAndLogin(app, "changepw4@example.com");

    const res = await pro.authed.post("/api/v1/professionals/change-password").send({
      currentPassword: TEST_PASSWORD,
      newPassword: "short",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a request with no auth cookie", async () => {
    const res = await request(app).post("/api/v1/professionals/change-password").send({
      currentPassword: TEST_PASSWORD,
      newPassword: "NewPassword123!",
    });

    expect(res.status).toBe(401);
  });

  it("rejects a request missing the CSRF header", async () => {
    const pro = await registerAndLogin(app, "changepw5@example.com");

    const res = await request(app)
      .post("/api/v1/professionals/change-password")
      .set("Cookie", pro.cookieHeader)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "NewPassword123!" });

    expect(res.status).toBe(403);
  });
});
