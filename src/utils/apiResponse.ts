import { Response } from "express";

export const sendResponse = <T>(
  res: Response,
  status: number,
  data?: T
) => {
  return res.status(status).json({
    ok: status >= 200 && status < 300,
    status,
    data,
  });
};
