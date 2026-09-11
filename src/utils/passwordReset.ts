import { createHash, randomBytes } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export const hashResetToken = (rawToken: string): string =>
  createHash("sha256").update(rawToken).digest("hex");

export const generateResetToken = (): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} => {
  const rawToken = randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
};
