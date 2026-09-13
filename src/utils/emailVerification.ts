import { createHash, randomBytes } from "crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export const hashVerificationToken = (rawToken: string): string =>
  createHash("sha256").update(rawToken).digest("hex");

export const generateVerificationToken = (): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} => {
  const rawToken = randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
};
