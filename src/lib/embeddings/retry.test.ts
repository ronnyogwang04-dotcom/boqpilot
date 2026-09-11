import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

const noSleep = () => Promise.resolve();

describe("withRetry", () => {
  it("returns the result immediately on first success, with no retries", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1, sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds once the underlying call recovers", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient 1"))
      .mockRejectedValueOnce(new Error("transient 2"))
      .mockResolvedValueOnce("recovered");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1, sleep: noSleep });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("propagates the last error once retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent failure"));

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1, sleep: noSleep })).rejects.toThrow(
      "permanent failure",
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it("calls onRetry with the attempt number and the error before each retry, not before the first try", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new Error("first failure")).mockResolvedValueOnce("ok");

    await withRetry(fn, { maxRetries: 2, baseDelayMs: 1, sleep: noSleep, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it("waits with exponential backoff between attempts", async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValueOnce(new Error("a")).mockRejectedValueOnce(new Error("b")).mockResolvedValueOnce("ok");

    await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(delays).toEqual([100, 200]);
  });
});
