import { randomUUID } from "crypto";
import { Request, Response } from "express";
import z from "zod";
import {
  clearCsrfCookieOptions,
  clearTokenCookieOptions,
  CSRF_COOKIE,
  csrfCookieOptions,
  TOKEN_COOKIE,
  tokenCookieOptions,
} from "../config/cookies.js";
import { Professional } from "../models/Professional.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { sendResponse } from "../utils/apiResponse.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import { generateToken } from "../utils/jwt.js";
import { generateResetToken, hashResetToken } from "../utils/passwordReset.js";
import {
  forgotPasswordSchema,
  loginProfessionalSchema,
  registerProfessionalSchema,
  resetPasswordSchema,
} from "../validators/professionalSchemas.js";

const setAuthCookies = (res: Response, token: string) => {
  res.cookie(TOKEN_COOKIE, token, tokenCookieOptions);
  res.cookie(CSRF_COOKIE, randomUUID(), csrfCookieOptions);
};

type RegisterInput = z.infer<typeof registerProfessionalSchema>["body"];
type LoginInput = z.infer<typeof loginProfessionalSchema>["body"];
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];

// @desc    Register professional
// @route   POST /api/professionals/register
// @access  Public
export const registerProfessional = async (req: Request, res: Response) => {
  const { email, password, profession } = req.validated!.body as RegisterInput;
  const professional = await Professional.create({
    email,
    password,
    profession,
  });

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  setAuthCookies(res, token);

  return sendResponse(res, 201, {
    id: professional._id,
    email: professional.email,
    profession: professional.profession,
    token,
  });
};

// @desc    Login professional
// @route   POST /api/professionals/login
// @access  Public
export const loginProfessional = async (req: Request, res: Response) => {
  const { email, password } = req.validated!.body as LoginInput;

  const professional = await Professional.findOne({ email });

  if (!professional) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  const isMatch = await professional.comparePassword(password);

  if (!isMatch) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  setAuthCookies(res, token);

  return sendResponse(res, 200, {
    token,
  });
};

// @desc    Logout professional
// @route   POST /api/professionals/logout
// @access  Private
export const logoutProfessional = async (_req: Request, res: Response) => {
  res.clearCookie(TOKEN_COOKIE, clearTokenCookieOptions);
  res.clearCookie(CSRF_COOKIE, clearCsrfCookieOptions);

  return sendResponse(res, 200, { message: "Logged out" });
};

// @desc    Request a password reset email
// @route   POST /api/professionals/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.validated!.body as ForgotPasswordInput;

  const professional = await Professional.findOne({ email });

  if (professional) {
    const { rawToken, tokenHash, expiresAt } = generateResetToken();

    professional.passwordResetTokenHash = tokenHash;
    professional.passwordResetTokenExpires = expiresAt;
    await professional.save({ validateModifiedOnly: true });

    sendPasswordResetEmail(professional.email, rawToken).catch((error) => {
      console.error("Failed to send password reset email:", error);
    });
  }

  return sendResponse(res, 200, {
    message:
      "If an account with that email exists, a password reset link has been sent.",
  });
};

// @desc    Reset password using a reset token
// @route   POST /api/professionals/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.validated!.body as ResetPasswordInput;

  const tokenHash = hashResetToken(token);

  const professional = await Professional.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetTokenExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetTokenExpires");

  if (!professional) {
    throw new ErrorResponse("Invalid or expired reset token", 400);
  }

  professional.password = password;
  professional.passwordResetTokenHash = null;
  professional.passwordResetTokenExpires = null;
  await professional.save();

  return sendResponse(res, 200, {
    message: "Password has been reset successfully. Please log in.",
  });
};
