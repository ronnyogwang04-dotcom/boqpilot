"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isDevPaymentBypassEnabled } from "@/lib/payments/dev-bypass";
import { applyBoqPaymentCompletion } from "@/lib/payments/service";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionState } from "@/types/action-state";

/**
 * Development-only: simulates a successful payment for a current-pricing
 * BOQ so the extraction/benchmarking pipeline can be tested without real
 * PayFast credentials. The environment check and the admin check are both
 * enforced HERE, server-side — this is the actual security boundary, not
 * whatever the UI chooses to render. A non-admin, or any request when
 * DEV_PAYMENT_BYPASS isn't set, gets the same generic rejection regardless
 * of what the client sent.
 *
 * Delete this file (and its one caller in the BOQ preview page) to remove
 * the bypass entirely once PayFast is live.
 */
export async function simulateDevPayment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!isDevPaymentBypassEnabled()) {
    return { status: "error", message: "The development payment bypass is not enabled." };
  }

  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You must be an admin to use the development payment bypass." };
  }

  const boqId = String(formData.get("boqId") ?? "");
  if (!boqId) {
    return { status: "error", message: "Missing BOQ." };
  }

  // Use the service client for the actual state change (matching the real
  // ITN handler's own pattern), but only after independently confirming the
  // BOQ belongs to the admin's own organisation — requireAdmin() only
  // proves *an* admin is signed in, not that this BOQ is theirs to unlock.
  const service = createServiceClient();

  const { data: boq } = await service
    .from("boqs")
    .select("id, project_id, price, currency")
    .eq("id", boqId)
    .single();
  if (!boq || !boq.project_id) {
    return { status: "error", message: "BOQ not found." };
  }

  const { data: project } = await service.from("projects").select("organisation_id").eq("id", boq.project_id).single();
  if (!project || project.organisation_id !== admin.organisationId) {
    return { status: "error", message: "BOQ not found." };
  }

  const { data: job } = await service.from("processing_jobs").select("status").eq("boq_id", boqId).single();
  if (!job || job.status !== "WAITING_FOR_PAYMENT") {
    return { status: "error", message: "This BOQ isn't waiting for payment." };
  }

  const amount = Number(boq.price);

  const { error: paymentError } = await service.from("payments").insert({
    user_id: admin.userId,
    payment_provider: "dev-bypass",
    amount,
    currency: boq.currency,
    item_name: "Development payment bypass",
    boq_id: boqId,
    payment_status: "complete",
    payment_date: new Date().toISOString(),
  });

  if (paymentError) {
    return { status: "error", message: "Could not record the simulated payment." };
  }

  // Exactly the same unlock side effects a real PayFast ITN triggers — see
  // applyBoqPaymentCompletion in src/lib/payments/service.ts.
  await applyBoqPaymentCompletion(service, boqId, amount, { devBypass: true, triggeredBy: admin.userId });

  revalidatePath(`/dashboard/projects/${boq.project_id}/boq/${boqId}`);
  revalidatePath(`/dashboard/projects/${boq.project_id}/boq/${boqId}/processing`);

  return { status: "success", message: "Development payment simulated — processing has started." };
}
