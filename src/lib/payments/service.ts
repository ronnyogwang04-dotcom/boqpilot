import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentProvider } from "./provider-factory";
import { logAuditEvent } from "@/lib/audit/log-event";
import type {
  CreatePaymentParams,
  PaymentNotification,
  PaymentProvider,
  PaymentRedirect,
  PaymentService as PaymentServiceInterface,
  PaymentStatus,
} from "./types";
import type { Database } from "@/types/database.types";

function withPaymentId(url: string, paymentId: string): string {
  const withParam = new URL(url);
  withParam.searchParams.set("payment", paymentId);
  return withParam.toString();
}

class PaymentServiceImpl implements PaymentServiceInterface {
  constructor(private readonly provider: PaymentProvider) {}

  async createPayment(
    supabase: SupabaseClient<Database>,
    params: CreatePaymentParams,
  ): Promise<PaymentRedirect> {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        user_id: params.userId,
        payment_provider: this.provider.name,
        amount: params.amount,
        currency: params.currency,
        item_name: params.itemName,
        boq_id: params.boqId ?? null,
        pricing_tier: params.pricingTier ?? null,
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (error || !payment) {
      throw new Error(`Could not create payment record: ${error?.message ?? "unknown error"}`);
    }

    return this.provider.createPayment({
      paymentId: payment.id,
      amount: params.amount,
      currency: params.currency,
      itemName: params.itemName,
      itemDescription: params.itemDescription,
      buyerEmail: params.buyerEmail,
      buyerFirstName: params.buyerFirstName,
      buyerLastName: params.buyerLastName,
      returnUrl: withPaymentId(params.returnUrl, payment.id),
      cancelUrl: withPaymentId(params.cancelUrl, payment.id),
      notifyUrl: params.notifyUrl,
    });
  }

  async processITN(rawBody: string, sourceIp: string | null): Promise<PaymentNotification> {
    const notification = await this.provider.parseNotification(rawBody, sourceIp);

    if (!notification.valid || !notification.paymentId) {
      console.error("ITN rejected:", notification.reason, notification.raw);
      return notification;
    }

    const supabase = createServiceClient();

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, amount, payment_status, boq_id")
      .eq("id", notification.paymentId)
      .single();

    if (fetchError || !payment) {
      console.error("ITN for unknown payment:", notification.paymentId);
      return notification;
    }

    if (payment.payment_status === "complete") {
      return notification;
    }

    const amountMatches =
      notification.amount !== null && Math.abs(notification.amount - Number(payment.amount)) < 0.01;

    if (!amountMatches) {
      console.error("ITN amount mismatch", {
        paymentId: payment.id,
        expected: payment.amount,
        received: notification.amount,
      });
      await supabase
        .from("payments")
        .update({ payment_status: "failed", raw_itn: notification.raw, updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return notification;
    }

    await supabase
      .from("payments")
      .update({
        payment_status: notification.status,
        provider_transaction_id: notification.providerTransactionId,
        raw_itn: notification.raw,
        payment_date: notification.status === "complete" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (notification.status === "complete" && payment.boq_id) {
      await this.applyBoqPaymentCompletion(supabase, payment.boq_id, Number(payment.amount));
    }

    return notification;
  }

  private async applyBoqPaymentCompletion(
    supabase: SupabaseClient<Database>,
    boqId: string,
    amount: number,
  ) {
    const { data: boq } = await supabase
      .from("boqs")
      .select("id, user_id, project_id, page_count")
      .eq("id", boqId)
      .single();

    if (!boq || !boq.project_id) return;

    // No queue worker exists yet — the job is moved straight to QUEUED and
    // parks there. A future worker picks up QUEUED jobs and takes it from here.
    await supabase
      .from("processing_jobs")
      .update({ status: "QUEUED", updated_at: new Date().toISOString() })
      .eq("boq_id", boqId);

    await supabase.from("project_timeline").insert({
      project_id: boq.project_id,
      event_type: "payment_received",
      metadata: { boq_id: boqId, amount },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation_id, paid_boq_count, total_pages_processed, lifetime_spend")
      .eq("id", boq.user_id)
      .single();

    if (!profile) return;

    await supabase
      .from("profiles")
      .update({
        paid_boq_count: profile.paid_boq_count + 1,
        total_pages_processed: profile.total_pages_processed + boq.page_count,
        lifetime_spend: Number(profile.lifetime_spend) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", boq.user_id);

    await logAuditEvent(supabase, {
      organisationId: profile.organisation_id,
      actorUserId: boq.user_id,
      eventType: "payment",
      entityType: "boq",
      entityId: boqId,
      metadata: { amount },
    });
  }

  async getPaymentStatus(
    supabase: SupabaseClient<Database>,
    paymentId: string,
  ): Promise<PaymentStatus | null> {
    const { data } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("id", paymentId)
      .single();

    return data?.payment_status ?? null;
  }

  async verifyPayment(paymentId: string): Promise<PaymentStatus | null> {
    // PayFast has no active "get transaction status" API beyond the ITN it
    // sends us — this re-derives status from our own stored record. A future
    // provider with a real verification endpoint would call out to it here.
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("id", paymentId)
      .single();

    return data?.payment_status ?? null;
  }

  async cancelPayment(): Promise<void> {
    throw new Error("cancelPayment is not implemented by any configured payment provider yet.");
  }

  async refundPayment(): Promise<void> {
    throw new Error("refundPayment is not implemented by any configured payment provider yet.");
  }
}

let service: PaymentServiceInterface | undefined;

// Single seam the application depends on — it never talks to a
// PaymentProvider (or PayFast) directly.
export function getPaymentService(): PaymentServiceInterface {
  if (!service) {
    service = new PaymentServiceImpl(getPaymentProvider());
  }
  return service;
}
