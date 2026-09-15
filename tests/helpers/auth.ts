import request from "supertest";
import type { Express } from "express";

export const TEST_PASSWORD = "TestPassword123!";

const extractCookieValue = (
  setCookieHeaders: string[] | undefined,
  name: string,
) => {
  const header = (setCookieHeaders ?? []).find((c) => c.startsWith(`${name}=`));
  if (!header) return undefined;
  return header.split(";")[0].split("=")[1];
};

// The auth cookies are Secure (see src/config/cookies.ts, deliberately Secure
// in every environment). supertest's request.agent() cookie jar won't resend
// a Secure cookie over the plain HTTP connection it uses internally, so we
// capture the raw Set-Cookie values ourselves and attach them by hand instead
// of relying on the agent's automatic jar.
const buildCookieHeader = (setCookieHeaders: string[] | undefined) =>
  (setCookieHeaders ?? []).map((c) => c.split(";")[0]).join("; ");

export const registerAndLogin = async (app: Express, email: string) => {
  const registerRes = await request(app)
    .post("/api/v1/professionals/register")
    .send({ email, password: TEST_PASSWORD });

  const verificationToken = registerRes.body.data.verificationToken as string;

  await request(app)
    .post("/api/v1/professionals/verify-email")
    .send({ token: verificationToken });

  // authMiddleware rejects a token whose (second-truncated) `iat` is earlier
  // than passwordChangedAt (millisecond precision) - registration's own
  // password-hashing hook sets passwordChangedAt at account creation, so
  // logging in immediately after (as tests do) can land in the same
  // wall-clock second and trip a false positive. Nudge it a few seconds into
  // the past, which is also just realistically how this flow plays out
  // outside a test (register -> verify email -> log in, never within the
  // same second).
  const { Professional } = await import("../../src/models/Professional.js");
  await Professional.updateOne(
    { email },
    { $set: { passwordChangedAt: new Date(Date.now() - 5000) } },
  );

  const loginRes = await request(app)
    .post("/api/v1/professionals/login")
    .send({ email, password: TEST_PASSWORD });

  const setCookies = loginRes.headers["set-cookie"] as unknown as
    | string[]
    | undefined;
  const cookieHeader = buildCookieHeader(setCookies);
  const csrfToken = extractCookieValue(setCookies, "csrfToken")!;
  const token = loginRes.body.data.token as string;

  // Convenience wrapper for tests that don't care about CSRF edge cases -
  // always attaches the cookie session + the correct CSRF header.
  const authed = {
    get: (path: string) => request(app).get(path).set("Cookie", cookieHeader),
    post: (path: string) =>
      request(app)
        .post(path)
        .set("Cookie", cookieHeader)
        .set("x-csrf-token", csrfToken),
    patch: (path: string) =>
      request(app)
        .patch(path)
        .set("Cookie", cookieHeader)
        .set("x-csrf-token", csrfToken),
    delete: (path: string) =>
      request(app)
        .delete(path)
        .set("Cookie", cookieHeader)
        .set("x-csrf-token", csrfToken),
  };

  return { cookieHeader, csrfToken, token, authed };
};
