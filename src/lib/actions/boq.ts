"use server";

import { randomUUID } from "node:crypto";
import readExcelFile from "read-excel-file/node";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPdfPageCount } from "@/lib/boq/pdf";
import { getPricingEngine } from "@/lib/pricing/pricing-engine";
import { isFreeTrialEligible } from "@/lib/pricing/free-trial";
import { pricingConfig } from "@/config/pricing";
import { boqPricingConfig } from "@/config/boq-pricing";
import { resolveSourceType } from "@/lib/historical-boq/parsers/registry";
import { processCurrentBoq } from "@/lib/boq-pricing/process-boq";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { ActionState } from "@/types/action-state";
import type { BoqLineItemSourceFormat } from "@/types/database.types";

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
    return { status: "error", message: "Please choose a file to upload." };
  }

  const resolvedType = resolveSourceType(file.name, file.type);
  if (resolvedType !== "excel" && resolvedType !== "pdf") {
    return { status: "error", message: "Only Excel (.xlsx, .xls) and PDF files are supported." };
  }
  const sourceFormat: BoqLineItemSourceFormat = resolvedType;

  const maxBytes = pricingConfig.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { status: "error", message: `File is too large (max ${pricingConfig.maxUploadSizeMb}MB).` };
  }

  // Page count (or, for Excel, a row-count-derived page-count equivalent)
  // drives the existing page-tier pricing engine unchanged — see
  // boqPricingConfig.excelRowsPerPageEquivalent for the approximation.
  let pageCount: number;
  try {
    if (sourceFormat === "pdf") {
      const buffer = await file.arrayBuffer();
      pageCount = await getPdfPageCount(buffer);
    } else {
      const sheets = await readExcelFile(Buffer.from(await file.arrayBuffer()));
      const totalRows = sheets.reduce((sum, sheet) => sum + sheet.data.length, 0);
      pageCount = Math.max(1, Math.ceil(totalRows / boqPricingConfig.excelRowsPerPageEquivalent));
    }
  } catch (error) {
    // Only getPdfPageCount()'s own message is written to be user-facing;
    // read-excel-file can throw a raw internal error here (this pre-read
    // bypasses ExcelParser's friendlier wrapping, since it only needs a row
    // count, not a full parse) — never show that verbatim.
    console.error("uploadBoq: failed to read file for page count", error);
    const message =
      sourceFormat === "pdf" && error instanceof Error
        ? error.message
        : "We couldn't read this file. Please check that it's a valid, unencrypted Excel or PDF BOQ and try again.";
    return { status: "error", message };
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

  // Pre-generate the id so the storage path can be known before insert —
  // same convention as uploadHistoricalBoq(). Real extraction needs the
  // file bytes, so (unlike before) they're now persisted to a private,
  // organisation-scoped bucket rather than discarded after the page count.
  const boqId = randomUUID();
  const storagePath = `${profile.organisation_id}/${boqId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("pricing-boqs")
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    return { status: "error", message: "Could not upload this file. Please try again." };
  }

  const { data: boq, error: boqError } = await supabase
    .from("boqs")
    .insert({
      id: boqId,
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
      storage_path: storagePath,
      source_format: sourceFormat,
    })
    .select("id")
    .single();

  if (boqError || !boq) {
    await supabase.storage.from("pricing-boqs").remove([storagePath]);
    return { status: "error", message: "Could not save this BOQ. Please try again." };
  }

  // No queue worker exists yet — a free BOQ has nothing to wait on, so its
  // job goes straight to QUEUED and parks there; a paid one waits for
  // PayFast (see src/lib/payments/service.ts for the paid-path trigger).
  const initialStatus = pricing.isFree ? "QUEUED" : "WAITING_FOR_PAYMENT";
  await supabase.from("processing_jobs").insert({
    boq_id: boq.id,
    project_id: projectId,
    status: initialStatus,
  });

  if (initialStatus === "QUEUED") {
    await processCurrentBoq(supabase, boq.id);
  }

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
