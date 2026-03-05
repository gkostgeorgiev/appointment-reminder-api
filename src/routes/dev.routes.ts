import { Router } from "express";
import { sendSms } from "../services/smsService.js";
import { catchAsync } from "../utils/catchAsync.js";

const router = Router();

router.get("/test-sms", catchAsync(async (req, res) => {
  const personalPhoneNumber = process.env.PERSONAL_NUMBER!;
  const result = await sendSms(personalPhoneNumber, "Test reminder");

  res.json(result);
}));

export default router;
