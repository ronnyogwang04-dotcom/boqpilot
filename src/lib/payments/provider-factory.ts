import { PayFastPaymentProvider } from "./payfast/provider";
import type { PaymentProvider } from "./types";

let provider: PaymentProvider | undefined;

// The only place in the app with provider-specific knowledge. Adding Ozow,
// Yoco, Peach Payments, or Stripe later means implementing PaymentProvider
// and adding a case here — nothing else in the app needs to change.
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    const name = process.env.PAYMENT_PROVIDER || "payfast";

    switch (name) {
      case "payfast":
        provider = new PayFastPaymentProvider();
        break;
      default:
        throw new Error(`Unknown PAYMENT_PROVIDER: ${name}`);
    }
  }
  return provider;
}
