import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

export const sendPasswordResetEmail = async (to: string, rawToken: string) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  // The Resend SDK never rejects on an API-level failure (bad key, rate
  // limit, invalid domain, etc.) - it resolves to { data: null, error }
  // either way. Throw explicitly so callers can use a normal try/catch.
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

export const sendVerificationEmail = async (to: string, rawToken: string) => {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your email",
    html: `<p>Click the link below to verify your email address. This link expires in 24 hours.</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>`,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};
