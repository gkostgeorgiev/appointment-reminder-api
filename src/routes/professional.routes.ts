import { Request, Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  loginProfessional,
  logoutProfessional,
  registerProfessional,
  resetPassword,
} from "../controllers/professional.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  forgotPasswordSchema,
  loginProfessionalSchema,
  registerProfessionalSchema,
  resetPasswordSchema,
} from "../validators/professionalSchemas.js";

const router = Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    status: 429,
    message: "Too many password reset requests. Please try again later.",
  },
});

router.post(
  "/register",
  validate(registerProfessionalSchema),
  catchAsync(registerProfessional),
);

router.post(
  "/login",
  validate(loginProfessionalSchema),
  catchAsync(loginProfessional),
);

router.get(
  "/me",
  authMiddleware,
  catchAsync(async (req: Request, res) => {
    res.json({
      message: "Protected route accessed",
      user: req.user,
    });
  }),
);

router.post("/logout", authMiddleware, catchAsync(logoutProfessional));

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  catchAsync(forgotPassword),
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  catchAsync(resetPassword),
);

export default router;
