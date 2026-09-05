import { CookieOptions } from "express";

export const TOKEN_COOKIE = "token";
export const CSRF_COOKIE = "csrfToken";
export const CSRF_HEADER = "x-csrf-token";

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
