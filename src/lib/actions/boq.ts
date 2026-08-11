"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPdfPageCount } from "@/lib/boq/pdf";
import { getPricingEngine } from "@/lib/pricing/pricing-engine";
import { isFreeTrialEligible } from "@/lib/pricing/free-trial";
import { pricingConfig } from "@/config/pricing";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { ActionState } from "@/types/action-state";

export async function uploadBoq(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to upload a BOQ." };
  }

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || !projectId) {
    return { status: "error", message: "No project specified." };
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please choose a PDF file to upload." };
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { status: "error", message: "Only PDF files are supported." };
  }

  const maxBytes = pricingConfig.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { status: "error", message: `File is too large (max ${pricingConfig.maxUploadSizeMb}MB).` };
  }

  // The buffer is only ever used in-memory to count pages — it is never
  // written to storage or a database column.
  const buffer = await file.arrayBuffer();

  let pageCount: number;
  try {
    pageCount = await getPdfPageCount(buffer);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not read PDF." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id, free_boq_used, total_pages_processed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { status: "error", message: "Could not load your profile." };
  }

  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).single();
  if (!project) {
    return { status: "error", message: "Project not found." };
  }

  const eligibleForFreeTrial = isFreeTrialEligible(profile, pageCount);
  const pricing = getPricingEngine().calculatePrice({
    pageCount,
    isFreeTrialEligible: eligibleForFreeTrial,
  });

  const { data: lastVersion } = await supabase
    .from("project_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (lastVersion?.version_number ?? 0) + 1;
  const versionLabel = versionNumber === 1 ? "Original BOQ" : `Revision ${versionNumber - 1}`;

  const { data: version, error: versionError } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      version_number: versionNumber,
      version_label: versionLabel,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return { status: "error", message: "Could not create a new BOQ version." };
  }

  const { data: boq, error: boqError } = await supabase
    .from("boqs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      project_version_id: version.id,
      filename: file.name,
      file_size_bytes: file.size,
      page_count: pageCount,
      pricing_tier: pricing.tier,
      price: pricing.price,
      currency: pricing.currency,
      is_free: pricing.isFree,
    })
    .select("id")
    .single();

  if (boqError || !boq) {
    return { status: "error", message: "Could not save this BOQ. Please try again." };
  }

  // No queue worker exists yet — a free BOQ has nothing to wait on, so its
  // job goes straight to QUEUED and parks there; a paid one waits for PayFast.
  await supabase.from("processing_jobs").insert({
    boq_id: boq.id,
    project_id: projectId,
    status: pricing.isFree ? "QUEUED" : "WAITING_FOR_PAYMENT",
  });

  await supabase.from("project_timeline").insert({
    project_id: projectId,
    event_type: "boq_uploaded",
    metadata: { boq_id: boq.id, version_label: versionLabel },
  });

  if (pricing.isFree) {
    await supabase
      .from("profiles")
      .update({
        free_boq_used: true,
        free_boq_used_at: new Date().toISOString(),
        total_pages_processed: profile.total_pages_processed + pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await supabase.from("project_timeline").insert({
      project_id: projectId,
      event_type: "payment_received",
      metadata: { boq_id: boq.id, amount: 0 },
    });
  }

  await logAuditEvent(supabase, {
    organisationId: profile.organisation_id,
    actorUserId: user.id,
    eventType: "upload",
    entityType: "boq",
    entityId: boq.id,
    metadata: { project_id: projectId, page_count: pageCount },
  });

  redirect(`/dashboard/projects/${projectId}/boq/${boq.id}`);
}
