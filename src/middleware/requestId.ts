import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = `req_${uuidv4().slice(0, 8)}`;

  req.requestId = requestId;

  res.setHeader("X-Request-Id", requestId);

  next();
};