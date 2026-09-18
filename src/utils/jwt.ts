import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface JwtPayload {
  userId: string;
  email: string;
  // Millisecond-precision issue time, set by generateToken. Compared against
  // Professional.passwordChangedAt in authMiddleware instead of the standard
  // `iat` claim, which is only second-precision (jsonwebtoken floors it) and
  // can spuriously predate a same-second password change. See issue #11.
  iatMs?: number;
  iat?: number;
  exp?: number;
}

export const generateToken = (payload: {
  userId: string;
  email: string;
}): string => {
  return jwt.sign({ ...payload, iatMs: Date.now() }, env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};
