import twilio from "twilio";
import { env } from "../config/env.js";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export const sendSms = async (
  to: string,
  message: string | undefined,
) => {
  const result = await client.messages.create({
    body: message ?? "Hello world",
    from: env.TWILIO_PHONE_NUMBER,
    to,
  });

  return result;
};
