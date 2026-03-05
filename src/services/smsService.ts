import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export const sendSms = async (
  to: string,
  message: string | undefined,
) => {
  const result = await client.messages.create({
    body: message ?? "Hello world",
    from: twilioPhoneNumber,
    to,
  });

  return result;
};
