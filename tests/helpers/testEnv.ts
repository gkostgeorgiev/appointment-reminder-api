export const setTestEnv = (mongoUri: string) => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "5000";
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = "test-jwt-secret-".padEnd(40, "x");
  process.env.CORS_ORIGIN = "http://localhost:3000";
  process.env.TWILIO_ACCOUNT_SID = `AC${"0".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "test-twilio-auth-token-".padEnd(40, "x");
  process.env.TWILIO_PHONE_NUMBER = "+15555550100";
  process.env.RUN_REMINDER_WORKER = "false";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "test@example.com";
  process.env.FRONTEND_URL = "http://localhost:3000";
};
