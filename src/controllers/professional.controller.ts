import { randomUUID } from "crypto";
import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import z from "zod";
import {
  clearCsrfCookieOptions,
  clearRefreshTokenCookieOptions,
  clearTokenCookieOptions,
  CSRF_COOKIE,
  csrfCookieOptions,
  REFRESH_TOKEN_COOKIE,
  refreshTokenCookieOptions,
  TOKEN_COOKIE,
  tokenCookieOptions,
} from "../config/cookies.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Professional } from "../models/Professional.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/emailService.js";
import { sendResponse } from "../utils/apiResponse.js";
import {
  generateVerificationToken,
  hashVerificationToken,
} from "../utils/emailVerification.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import { generateToken } from "../utils/jwt.js";
import { generateResetToken, hashResetToken } from "../utils/passwordReset.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/refreshToken.js";
import {
  forgotPasswordSchema,
  loginProfessionalSchema,
  registerProfessionalSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validators/professionalSchemas.js";

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie(TOKEN_COOKIE, accessToken, tokenCookieOptions);
  res.cookie(CSRF_COOKIE, randomUUID(), csrfCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);
};

type RegisterInput = z.infer<typeof registerProfessionalSchema>["body"];
type LoginInput = z.infer<typeof loginProfessionalSchema>["body"];
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
type VerifyEmailInput = z.infer<typeof verifyEmailSchema>["body"];
type ResendVerificationInput = z.infer<typeof resendVerificationSchema>["body"];

// @desc    Register professional
// @route   POST /api/professionals/register
// @access  Public
export const registerProfessional = async (req: Request, res: Response) => {
  const { email, password, profession } = req.validated!.body as RegisterInput;
  const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

  const professional = await Professional.create({
    email,
    password,
    profession,
    emailVerificationTokenHash: tokenHash,
    emailVerificationTokenExpires: expiresAt,
  });

  try {
    await sendVerificationEmail(professional.email, rawToken);
  } catch (error) {
    logger.error({ err: error }, "Failed to send verification email");
    Sentry.captureException(error);
  }

  return sendResponse(res, 201, {
    id: professional._id,
    email: professional.email,
    profession: professional.profession,
    // dev/test convenience: lets you verify without a real inbox (Resend's
    // sandbox mode won't deliver to arbitrary test addresses) - never exposed
    // in production.
    ...(env.NODE_ENV !== "production" ? { verificationToken: rawToken } : {}),
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

  if (!professional.isEmailVerified) {
    throw new ErrorResponse("Please verify your email before logging in", 403);
  }

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  const { rawToken: refreshToken, tokenHash, expiresAt } = generateRefreshToken();
  professional.refreshTokenHash = tokenHash;
  professional.refreshTokenExpires = expiresAt;
  await professional.save({ validateModifiedOnly: true });

  setAuthCookies(res, token, refreshToken);

  return sendResponse(res, 200);
};

// @desc    Exchange a refresh token for a new access token
// @route   POST /api/professionals/refresh
// @access  Public (requires a valid refreshToken cookie)
export const refreshAccessToken = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!rawToken) {
    throw new ErrorResponse("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashRefreshToken(rawToken);
  const {
    rawToken: newRefreshToken,
    tokenHash: newTokenHash,
    expiresAt,
  } = generateRefreshToken();

  // Atomic find-and-rotate: the filter only matches while refreshTokenHash
  // still equals the presented token, so concurrent requests racing on the
  // same refresh token can't both succeed - the second one's filter no
  // longer matches once the first has rotated it.
  const professional = await Professional.findOneAndUpdate(
    {
      refreshTokenHash: tokenHash,
      refreshTokenExpires: { $gt: new Date() },
    },
    { $set: { refreshTokenHash: newTokenHash, refreshTokenExpires: expiresAt } },
  );

  if (!professional) {
    throw new ErrorResponse("Invalid or expired refresh token", 401);
  }

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  setAuthCookies(res, token, newRefreshToken);

  return sendResponse(res, 200);
};

// @desc    Logout professional
// @route   POST /api/professionals/logout
// @access  Private
export const logoutProfessional = async (req: Request, res: Response) => {
  await Professional.updateOne(
    { _id: req.user!.userId },
    { $set: { refreshTokenHash: null, refreshTokenExpires: null } },
  );

  res.clearCookie(TOKEN_COOKIE, clearTokenCookieOptions);
  res.clearCookie(CSRF_COOKIE, clearCsrfCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshTokenCookieOptions);

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

    try {
      await sendPasswordResetEmail(professional.email, rawToken);
    } catch (error) {
      logger.error({ err: error }, "Failed to send password reset email");
      Sentry.captureException(error);
    }
  }

  // The message and status stay identical whether the account exists, and
  // whether the send above succeeded or failed - anything that varies here
  // based on account existence or delivery outcome would let an attacker
  // enumerate registered emails.
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

  // Atomic find-and-clear: matching and clearing the token in one update
  // means a concurrent request presenting the same (already-consumed) token
  // simply won't match, instead of both requests reading the token as valid
  // before either clears it.
  const professional = await Professional.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpires: { $gt: new Date() },
    },
    { $set: { passwordResetTokenHash: null, passwordResetTokenExpires: null } },
  );

  if (!professional) {
    throw new ErrorResponse("Invalid or expired reset token", 400);
  }

  professional.password = password;
  await professional.save();

  return sendResponse(res, 200, {
    message: "Password has been reset successfully. Please log in.",
  });
};

// @desc    Verify email using a verification token
// @route   POST /api/professionals/verify-email
// @access  Public
export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.validated!.body as VerifyEmailInput;

  const tokenHash = hashVerificationToken(token);

  // Atomic find-and-clear, same reasoning as resetPassword: verifying and
  // clearing the token in one update closes the window where two concurrent
  // requests could both read the token as still valid.
  const professional = await Professional.findOneAndUpdate(
    {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpires: { $gt: new Date() },
    },
    {
      $set: {
        isEmailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationTokenExpires: null,
      },
    },
  );

  if (!professional) {
    throw new ErrorResponse("Invalid or expired verification token", 400);
  }

  return sendResponse(res, 200, {
    message: "Email verified successfully. Please log in.",
  });
};

// @desc    Resend the email verification link
// @route   POST /api/professionals/resend-verification
// @access  Public
export const resendVerificationEmail = async (req: Request, res: Response) => {
  const { email } = req.validated!.body as ResendVerificationInput;

  const professional = await Professional.findOne({ email });

  let rawToken: string | undefined;

  if (professional && !professional.isEmailVerified) {
    const generated = generateVerificationToken();
    rawToken = generated.rawToken;

    professional.emailVerificationTokenHash = generated.tokenHash;
    professional.emailVerificationTokenExpires = generated.expiresAt;
    await professional.save({ validateModifiedOnly: true });

    try {
      await sendVerificationEmail(professional.email, rawToken);
    } catch (error) {
      logger.error({ err: error }, "Failed to send verification email");
      Sentry.captureException(error);
    }
  }

  // Same anti-enumeration reasoning as forgotPassword: the response never
  // varies with account existence or delivery outcome.
  return sendResponse(res, 200, {
    message:
      "If an account with that email exists and is not yet verified, a verification link has been sent.",
    // dev/test convenience, see registerProfessional - omitted in production,
    // and only present when a token was actually (re)issued.
    ...(env.NODE_ENV !== "production" && rawToken
      ? { verificationToken: rawToken }
      : {}),
  });
};
