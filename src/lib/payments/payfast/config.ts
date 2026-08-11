export type PayFastMode = "sandbox" | "production";

// PayFast publishes these credentials for anyone to use against the sandbox
// — safe to fall back to them in sandbox mode so the integration works
// before a merchant account is registered.
const SANDBOX_DEFAULT_MERCHANT_ID = "10000100";
const SANDBOX_DEFAULT_MERCHANT_KEY = "46f0cd694581a";

export function getPayFastConfig() {
  const mode: PayFastMode = process.env.PAYFAST_MODE === "production" ? "production" : "sandbox";
  const isSandbox = mode === "sandbox";

  const merchantId = process.env.PAYFAST_MERCHANT_ID || (isSandbox ? SANDBOX_DEFAULT_MERCHANT_ID : "");
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || (isSandbox ? SANDBOX_DEFAULT_MERCHANT_KEY : "");
  const passphrase = process.env.PAYFAST_PASSPHRASE || undefined;

  if (!merchantId || !merchantKey) {
    throw new Error(
      "PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set (required in production mode).",
    );
  }

  return {
    mode,
    isSandbox,
    merchantId,
    merchantKey,
    passphrase,
    processUrl: isSandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process",
    validateUrl: isSandbox
      ? "https://sandbox.payfast.co.za/eng/query/validate"
      : "https://www.payfast.co.za/eng/query/validate",
    validHosts: isSandbox
      ? ["sandbox.payfast.co.za"]
      : ["www.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za"],
  };
}
