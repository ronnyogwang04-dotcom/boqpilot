import { getPayFastConfig } from "./config";
import { generateSignature } from "./signature";
import { isValidPayFastSourceIp } from "./verify-source";
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentNotification,
  PaymentRedirect,
} from "../types";

export class PayFastPaymentProvider implements PaymentProvider {
  readonly name = "payfast";

  async createPayment(input: CreatePaymentInput): Promise<PaymentRedirect> {
    const { merchantId, merchantKey, passphrase, processUrl } = getPayFastConfig();

    // Order matters: PayFast signs (and expects) fields in this exact
    // sequence, per their "Website Payments On-Site" attribute table.
    const pairs: Array<[string, string]> = [
      ["merchant_id", merchantId],
      ["merchant_key", merchantKey],
      ["return_url", input.returnUrl],
      ["cancel_url", input.cancelUrl],
      ["notify_url", input.notifyUrl],
      ["name_first", input.buyerFirstName ?? ""],
      ["name_last", input.buyerLastName ?? ""],
      ["email_address", input.buyerEmail ?? ""],
      ["m_payment_id", input.paymentId],
      ["amount", input.amount.toFixed(2)],
      ["item_name", input.itemName],
      ["item_description", input.itemDescription ?? ""],
    ];

    const signature = generateSignature(pairs, passphrase, { skipEmpty: true });

    const fields: Record<string, string> = {};
    for (const [key, value] of pairs) {
      if (value !== "") fields[key] = value;
    }
    fields.signature = signature;

    return { actionUrl: processUrl, method: "POST", fields };
  }

  async parseNotification(rawBody: string, sourceIp: string | null): Promise<PaymentNotification> {
    const params = new URLSearchParams(rawBody);
    const raw: Record<string, string> = {};
    const pairs: Array<[string, string]> = [];

    for (const [key, value] of params) {
      raw[key] = value;
      if (key !== "signature") pairs.push([key, value]);
    }

    const emptyResult: Omit<PaymentNotification, "valid" | "reason"> = {
      paymentId: raw.m_payment_id ?? null,
      providerTransactionId: raw.pf_payment_id ?? null,
      status: "failed",
      amount: raw.amount_gross ? Number(raw.amount_gross) : null,
      currency: "ZAR",
      raw,
    };

    const { passphrase, validateUrl } = getPayFastConfig();

    const receivedSignature = raw.signature;
    const expectedSignature = generateSignature(pairs, passphrase, { skipEmpty: false });
    if (!receivedSignature || receivedSignature !== expectedSignature) {
      return { ...emptyResult, valid: false, reason: "Signature mismatch" };
    }

    const sourceIpValid = await isValidPayFastSourceIp(sourceIp);
    if (!sourceIpValid) {
      return { ...emptyResult, valid: false, reason: `Untrusted source IP: ${sourceIp ?? "unknown"}` };
    }

    let postbackValid = false;
    try {
      const response = await fetch(validateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: rawBody,
      });
      const text = (await response.text()).trim();
      postbackValid = text === "VALID";
    } catch {
      postbackValid = false;
    }

    if (!postbackValid) {
      return { ...emptyResult, valid: false, reason: "PayFast postback validation failed" };
    }

    const status = raw.payment_status === "COMPLETE" ? "complete" : "failed";

    return { ...emptyResult, valid: true, status };
  }
}
