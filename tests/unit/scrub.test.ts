import { describe, it, expect } from "vitest";
import { scrub } from "../../src/utils/scrub.js";

describe("scrub", () => {
  it("redacts an email address", () => {
    expect(scrub("contact them at maria.ivanova@example.com please")).toBe(
      "contact them at [REDACTED_EMAIL] please",
    );
  });

  it("redacts a phone number", () => {
    expect(scrub("call +359888123456 now")).toBe(
      "call [REDACTED_PHONE] now",
    );
  });

  it("redacts both an email and a phone number in the same string", () => {
    expect(
      scrub("Twilio error for maria@example.com at +359888123456: failed"),
    ).toBe("Twilio error for [REDACTED_EMAIL] at [REDACTED_PHONE]: failed");
  });

  it("leaves a message with no PII untouched", () => {
    expect(scrub("Database connection failed: timeout")).toBe(
      "Database connection failed: timeout",
    );
  });
});
