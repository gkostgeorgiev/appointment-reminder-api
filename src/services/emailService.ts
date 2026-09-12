import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

export const sendPasswordResetEmail = async (to: string, rawToken: string) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  });
};
