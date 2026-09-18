import twilio from "twilio";
import { env } from "../config/env.js";

// The Twilio SDK only exposes a request timeout at client-construction time,
// not per-call - this bounds every request this client makes.
const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, {
  timeout: 15_000,
});

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
