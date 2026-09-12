import { Router } from "express";
import { env } from "../config/env.js";
import { sendSms } from "../services/smsService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { ErrorResponse } from "../utils/errorResponse.js";

const router = Router();

router.get("/test-sms", catchAsync(async (req, res) => {
  if (!env.PERSONAL_NUMBER) {
    throw new ErrorResponse("PERSONAL_NUMBER is not configured", 500);
  }

  const result = await sendSms(env.PERSONAL_NUMBER, "Test reminder");

  res.json(result);
}));

export default router;
