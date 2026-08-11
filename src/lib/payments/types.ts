import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type PaymentStatus = "pending" | "complete" | "failed" | "cancelled";

/** What a PaymentProvider needs to build a redirect to its hosted payment page. */
export interface CreatePaymentInput {
  /** Our internal payments.id — echoed back by the provider so we can correlate. */
  paymentId: string;
  /** Major currency units, e.g. Rand (not cents). */
  amount: number;
  currency: string;
  itemName: string;
  itemDescription?: string;
  buyerEmail?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

/** Everything the client needs to hand the buyer off to the provider's hosted payment page. */
export interface PaymentRedirect {
  actionUrl: string;
  method: "GET" | "POST";
  fields: Record<string, string>;
}

export interface PaymentNotification {
  /** False if the signature, source, or postback check failed — never trust the payload if false. */
  valid: boolean;
  /** Our internal payments.id, parsed from the provider's echoed reference. Null if unparsable. */
  paymentId: string | null;
  /** The provider's own transaction id, for audit/reconciliation. */
  providerTransactionId: string | null;
  status: PaymentStatus;
  amount: number | null;
  currency: string | null;
  /** The raw fields the provider sent, stored as-is for auditing. */
  raw: Record<string, string>;
  /** Populated when valid === false, for logging. */
  reason?: string;
}

/**
 * A payment provider integration — the only layer that speaks a gateway's
 * native API shape (PayFast today; Ozow/Yoco/Peach/Stripe in future). The
 * rest of the app never depends on this directly, only on PaymentService.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentRedirect>;
  /**
   * Parses and verifies an inbound server-to-server payment notification
   * (PayFast calls this an ITN). `rawBody` must be the untouched request
   * body so signature verification can reproduce the provider's hash.
   */
  parseNotification(rawBody: string, sourceIp: string | null): Promise<PaymentNotification>;
}

/** Input to PaymentService.createPayment — provider-agnostic, app-level. */
export interface CreatePaymentParams {
  userId: string;
  amount: number;
  currency: string;
  itemName: string;
  itemDescription?: string;
  buyerEmail?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Set when this payment is for a BOQ (as opposed to e.g. a subscription plan). */
  boqId?: string;
  /** The pricing tier this amount was derived from, for audit/reporting. */
  pricingTier?: string;
}

/**
 * Provider-independent payment orchestration: the only thing the application
 * (and the Pricing Engine's callers) talk to. It persists the payments row
 * and delegates to whichever PaymentProvider is configured — swapping
 * providers never requires changing application code.
 */
export interface PaymentService {
  createPayment(
    supabase: SupabaseClient<Database>,
    params: CreatePaymentParams,
  ): Promise<PaymentRedirect>;

  /** Verifies and applies an inbound ITN. Always safe to call — never throws on invalid payloads. */
  processITN(rawBody: string, sourceIp: string | null): Promise<PaymentNotification>;

  getPaymentStatus(
    supabase: SupabaseClient<Database>,
    paymentId: string,
  ): Promise<PaymentStatus | null>;

  /**
   * Actively re-verifies a payment against the provider, for providers that
   * support it. PayFast has no such API beyond ITN, so this re-derives
   * status from our own stored record instead of calling out.
   */
  verifyPayment(paymentId: string): Promise<PaymentStatus | null>;

  /** Placeholder — no configured provider supports this yet. */
  cancelPayment(paymentId: string): Promise<void>;

  /** Placeholder — no configured provider supports this yet. */
  refundPayment(paymentId: string, amount?: number): Promise<void>;
}
