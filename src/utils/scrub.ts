const PHONE_REGEX = /\+?\d[\d\s().-]{6,}\d/g;
const EMAIL_REGEX = /[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/g;

// Shared by Sentry's beforeSend (src/config/sentry.ts) and the app logger
// (src/config/logger.ts) - this repo handles patient-adjacent PII (customer
// name/phone/email), and a provider error can otherwise echo a real phone
// number or email in its message.
export const scrub = (value: string) =>
  value.replace(EMAIL_REGEX, "[REDACTED_EMAIL]").replace(PHONE_REGEX, "[REDACTED_PHONE]");
