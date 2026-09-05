import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt.js";
import { CSRF_COOKIE, CSRF_HEADER, TOKEN_COOKIE } from "../config/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  const authHeader = req.headers.authorization;

  let token: string | undefined;
  let viaCookie = false;

  if (cookieToken) {
    token = cookieToken;
    viaCookie = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (viaCookie && !SAFE_METHODS.has(req.method)) {
    const csrfHeader = req.headers[CSRF_HEADER];
    const csrfCookie = req.cookies?.[CSRF_COOKIE];

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ message: "Invalid or missing CSRF token" });
    }
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
