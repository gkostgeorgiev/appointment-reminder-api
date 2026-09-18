import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { setTestEnv } from "../helpers/testEnv.js";

setTestEnv("mongodb://localhost:27017/unused");

vi.mock("resend", () => {
  class Resend {
    emails = {
      // Never resolves - simulates a stalled provider call.
      send: vi.fn(() => new Promise(() => {})),
    };
  }

  return { Resend };
});

let sendVerificationEmail: typeof import("../../src/services/emailService.js")["sendVerificationEmail"];
let sendPasswordResetEmail: typeof import("../../src/services/emailService.js")["sendPasswordResetEmail"];

beforeAll(async () => {
  ({ sendVerificationEmail, sendPasswordResetEmail } = await import(
    "../../src/services/emailService.js"
  ));
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("emailService timeout", () => {
  it("sendVerificationEmail rejects instead of hanging forever when Resend stalls", async () => {
    const promise = sendVerificationEmail("test@example.com", "raw-token");
    const assertion = expect(promise).rejects.toThrow(/timed out/);

    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("sendPasswordResetEmail rejects instead of hanging forever when Resend stalls", async () => {
    const promise = sendPasswordResetEmail("test@example.com", "raw-token");
    const assertion = expect(promise).rejects.toThrow(/timed out/);

    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
