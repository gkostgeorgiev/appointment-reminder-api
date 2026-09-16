import { NextFunction, Request, Response } from "express";
import { CSRF_COOKIE, CSRF_HEADER, TOKEN_COOKIE } from "../config/cookies.js";
import { Professional } from "../models/Professional.js";
import { verifyToken } from "../utils/jwt.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.[TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!SAFE_METHODS.has(req.method)) {
    const csrfHeader = req.headers[CSRF_HEADER];
    const csrfCookie = req.cookies?.[CSRF_COOKIE];

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ message: "Invalid or missing CSRF token" });
    }
  }

  try {
    const decoded = verifyToken(token);

    const professional = await Professional.findById(decoded.userId)
      .select("passwordChangedAt")
      .lean();

    if (!professional) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (
      professional.passwordChangedAt &&
      typeof decoded.iat === "number" &&
      decoded.iat * 1000 < professional.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
