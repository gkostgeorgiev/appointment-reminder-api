import { createHash, randomBytes } from "crypto";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export const hashRefreshToken = (rawToken: string): string =>
  createHash("sha256").update(rawToken).digest("hex");

export const generateRefreshToken = (): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} => {
  const rawToken = randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
};
