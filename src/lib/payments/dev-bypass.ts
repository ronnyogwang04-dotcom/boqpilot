import { isProductionEnv } from "@/lib/env";

// Development/Beta-only payment bypass gate. Two independent conditions must
// both hold — the app's explicit environment identity (APP_ENV/VERCEL_ENV,
// see src/lib/env.ts) must genuinely not be "production" AND the explicit
// opt-in flag must be set — so a stray env var alone (or a mis-set
// environment alone) can never unlock this in a real deployment. This
// intentionally does NOT key off NODE_ENV: Next.js forces NODE_ENV to
// "production" for every `next build` output, including Vercel Preview/Beta
// deployments, so NODE_ENV alone could never distinguish Beta from real
// production. Delete this file (and its one call site in
// src/lib/actions/dev-payment-bypass.ts, plus the UI block in the BOQ
// preview page) to remove the bypass entirely once PayFast is live —
// nothing else in the payment flow depends on it.
export function isDevPaymentBypassEnabled(): boolean {
  return !isProductionEnv() && process.env.DEV_PAYMENT_BYPASS === "true";
}
