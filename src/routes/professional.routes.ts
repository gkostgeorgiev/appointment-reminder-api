import { Request, Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  loginProfessional,
  logoutProfessional,
  registerProfessional,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from "../controllers/professional.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  forgotPasswordSchema,
  loginProfessionalSchema,
  registerProfessionalSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
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

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    status: 429,
    message: "Too many verification email requests. Please try again later.",
  },
});

const loginMessage = {
  ok: false,
  status: 429,
  message: "Too many login attempts. Please try again later.",
};

// Keyed by IP: catches an attacker hammering many accounts from one source.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: loginMessage,
});

// Keyed by the submitted email: catches an attacker grinding one account's
// password across rotating/distributed IPs, which the IP limiter can't see.
const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: loginMessage,
  keyGenerator: (req) => {
    const email = req.body?.email;
    return typeof email === "string" && email.trim()
      ? email.trim().toLowerCase()
      : "unknown";
  },
});

router.post(
  "/register",
  validate(registerProfessionalSchema),
  catchAsync(registerProfessional),
);

router.post(
  "/login",
  loginIpLimiter,
  loginEmailLimiter,
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

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  catchAsync(verifyEmail),
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validate(resendVerificationSchema),
  catchAsync(resendVerificationEmail),
);

export default router;
