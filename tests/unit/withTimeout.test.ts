import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "../../src/utils/withTimeout.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves normally when the promise settles before the timeout", async () => {
    const promise = withTimeout(Promise.resolve("done"), 1000, "test op");

    await expect(promise).resolves.toBe("done");
  });

  it("rejects with TimeoutError when the promise never settles in time", async () => {
    const never = new Promise(() => {});

    const promise = withTimeout(never, 1000, "test op");
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("includes the label and duration in the timeout error message", async () => {
    const never = new Promise(() => {});

    const promise = withTimeout(never, 1000, "test op");
    const assertion = expect(promise).rejects.toThrow(
      "test op timed out after 1000ms",
    );

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("rejects with the original error, not TimeoutError, when the promise rejects first", async () => {
    const promise = withTimeout(
      Promise.reject(new Error("boom")),
      1000,
      "test op",
    );

    await expect(promise).rejects.toThrow("boom");
  });
});
