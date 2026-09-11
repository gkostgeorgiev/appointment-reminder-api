import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_FROM = process.env.EMAIL_FROM!;
const FRONTEND_URL = process.env.FRONTEND_URL!;

export const sendPasswordResetEmail = async (to: string, rawToken: string) => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  });
};
