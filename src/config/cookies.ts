import { CookieOptions } from "express";
import { REFRESH_TOKEN_TTL_MS } from "../utils/refreshToken.js";

export const TOKEN_COOKIE = "token";
export const CSRF_COOKIE = "csrfToken";
export const CSRF_HEADER = "x-csrf-token";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

// Scoped to the professionals routes (login/refresh/logout are the only
// consumers) so the browser never sends this cookie to /customers or
// /appointments, shrinking its exposure.
const REFRESH_TOKEN_PATH = "/api/v1/professionals";

export const tokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 60 * 60 * 1000, // matches the 1h JWT expiry in src/utils/jwt.ts
};

export const csrfCookieOptions: CookieOptions = {
  ...tokenCookieOptions,
  httpOnly: false,
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: REFRESH_TOKEN_PATH,
};

// clearCookie must NOT carry maxAge — a Max-Age directive takes precedence
// over the Expires the clear sets, so the browser would keep the cookie
// alive instead of deleting it.
export const clearTokenCookieOptions: CookieOptions = {
  httpOnly: tokenCookieOptions.httpOnly,
  secure: tokenCookieOptions.secure,
  sameSite: tokenCookieOptions.sameSite,
};

export const clearCsrfCookieOptions: CookieOptions = {
  ...clearTokenCookieOptions,
  httpOnly: false,
};

export const clearRefreshTokenCookieOptions: CookieOptions = {
  httpOnly: refreshTokenCookieOptions.httpOnly,
  secure: refreshTokenCookieOptions.secure,
  sameSite: refreshTokenCookieOptions.sameSite,
  path: REFRESH_TOKEN_PATH,
};
