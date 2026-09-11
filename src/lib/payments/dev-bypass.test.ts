import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDevPaymentBypassEnabled } from "./dev-bypass";

describe("isDevPaymentBypassEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when the flag is unset, even outside production", () => {
    vi.stubEnv("APP_ENV", "development");
    expect(isDevPaymentBypassEnabled()).toBe(false);
  });

  it("is enabled when APP_ENV is development and the flag is exactly 'true'", () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("DEV_PAYMENT_BYPASS", "true");
    expect(isDevPaymentBypassEnabled()).toBe(true);
  });

  it("is enabled in the Beta/staging environment when the flag is set", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DEV_PAYMENT_BYPASS", "true");
    expect(isDevPaymentBypassEnabled()).toBe(true);
  });

  it("is enabled on a Vercel preview deployment (no explicit APP_ENV) when the flag is set", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DEV_PAYMENT_BYPASS", "true");
    expect(isDevPaymentBypassEnabled()).toBe(true);
  });

  it("is NEVER enabled in production, even if the flag is set — the whole point of the double condition", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DEV_PAYMENT_BYPASS", "true");
    expect(isDevPaymentBypassEnabled()).toBe(false);
  });

  it("is NEVER enabled on a Vercel production deployment, even if the flag is set", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEV_PAYMENT_BYPASS", "true");
    expect(isDevPaymentBypassEnabled()).toBe(false);
  });

  it("rejects truthy-but-not-exact values, to avoid an accidental typo silently enabling it", () => {
    vi.stubEnv("APP_ENV", "development");
    for (const value of ["1", "yes", "TRUE", "True", " true"]) {
      vi.stubEnv("DEV_PAYMENT_BYPASS", value);
      expect(isDevPaymentBypassEnabled()).toBe(false);
    }
  });
});
