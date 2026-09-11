"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { historicalLibraryConfig } from "@/config/historical-boq";
import { historicalBoqUploadSchema } from "@/lib/validations/historical-boq";
import { resolveSourceType, isLegacyXlsFile } from "@/lib/historical-boq/parsers/registry";
import { processHistoricalBoq } from "@/lib/historical-boq/process-historical-boq";
import type { ActionState } from "@/types/action-state";
import type { Database } from "@/types/database.types";

type UploadOneResult =
  | { status: "error"; message: string }
  | { status: "success"; historicalBoqId: string };

/**
 * Core per-file ingestion: validate, upload to storage, insert
 * historical_boqs + historical_boq_processing_jobs, run the (synchronous,
 * no-queue-worker) extraction pipeline, audit-log. Shared by the single-file
 * form action and the multi-file batch action so there is exactly one place
 * that knows how to ingest one historical BOQ.
 */
async function uploadOneHistoricalBoq(
  supabase: SupabaseClient<Database>,
  user: { id: string },
  organisationId: string,
  file: File,
  projectId: string | undefined,
): Promise<UploadOneResult> {
  if (file.size === 0) {
    return { status: "error", message: "Please choose a file to upload." };
  }

  const maxBytes = historicalLibraryConfig.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { status: "error", message: `File is too large (max ${historicalLibraryConfig.maxUploadSizeMb}MB).` };
  }

  if (isLegacyXlsFile(file.name, file.type)) {
    return {
      status: "error",
      message: "Legacy .xls files are not currently supported. Please save the workbook as .xlsx and upload again.",
    };
  }

  const sourceType = resolveSourceType(file.name, file.type);
  if (!sourceType) {
    return { status: "error", message: "Unsupported file type. Please upload an Excel file (.xlsx)." };
  }
  if (sourceType !== "excel") {
    return {
      status: "error",
      message: `${sourceType === "pdf" ? "PDF" : "Word"} historical BOQs aren't supported yet — please upload an Excel file (.xlsx).`,
    };
  }

  // Project is now optional "source project" metadata only — Historical BOQs
  // belong to the organisation's reusable library, not to a specific
  // project. If one is provided, we still confirm it exists for a friendlier
  // error than a dangling reference; the actual tenant isolation is RLS on
  // organisation_id, unaffected by whether project_id is set.
  if (projectId) {
    const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).single();
    if (!project) {
      return { status: "error", message: "Project not found." };
    }
  }

  const historicalBoqId = randomUUID();
  const storagePath = `${organisationId}/${historicalBoqId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("historical-boqs")
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    return { status: "error", message: "Could not upload this file. Please try again." };
  }

  const { data: historicalBoq, error: insertError } = await supabase
    .from("historical_boqs")
    .insert({
      id: historicalBoqId,
      organisation_id: organisationId,
      project_id: projectId ?? null,
      uploaded_by: user.id,
      source_type: sourceType,
      original_filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
    })
    .select("id")
    .single();

  if (insertError || !historicalBoq) {
    await supabase.storage.from("historical-boqs").remove([storagePath]);
    return { status: "error", message: "Could not save this upload. Please try again." };
  }

  const { data: job, error: jobError } = await supabase
    .from("historical_boq_processing_jobs")
    .insert({
      historical_boq_id: historicalBoq.id,
      organisation_id: organisationId,
      project_id: projectId ?? null,
      status: "UPLOADED",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { status: "error", message: "Upload saved, but could not start processing. Please try again." };
  }

  await processHistoricalBoq(supabase, job.id);

  await logAuditEvent(supabase, {
    organisationId,
    actorUserId: user.id,
    eventType: "upload",
    entityType: "historical_boq",
    entityId: historicalBoq.id,
    metadata: { project_id: projectId ?? null, filename: file.name },
  });

  return { status: "success", historicalBoqId: historicalBoq.id };
}

async function loadUploaderContext(
  supabase: SupabaseClient<Database>,
): Promise<{ user: { id: string }; organisationId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to upload a BOQ." };
  }

  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) {
    return { error: "Could not load your profile." };
  }

  return { user, organisationId: profile.organisation_id };
}

export async function uploadHistoricalBoq(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const context = await loadUploaderContext(supabase);
  if ("error" in context) {
    return { status: "error", message: context.error };
  }

  const parsed = historicalBoqUploadSchema.safeParse({
    projectId: formData.get("projectId"),
    returnToProject: formData.get("returnToProject"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid form data." };
  }
  const { projectId, returnToProject } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { status: "error", message: "Please choose a file to upload." };
  }

  const result = await uploadOneHistoricalBoq(supabase, context.user, context.organisationId, file, projectId);
  if (result.status === "error") {
    return result;
  }

  const returnParam = returnToProject ? `?returnToProject=${returnToProject}` : "";
  redirect(`/dashboard/historical-library/uploads/${result.historicalBoqId}${returnParam}`);
}

export type BatchUploadItemResult =
  | { fileName: string; status: "success"; historicalBoqId: string }
  | { fileName: string; status: "error"; message: string };

/**
 * Multi-file upload entry point. Each file is a fully independent request to
 * this action (called sequentially by the client orchestrator), so one bad
 * file (e.g. a rejected .xls) never blocks or hides another file's success —
 * there is no shared transaction across files.
 */
export async function uploadHistoricalBoqBatchItem(
  file: File,
  projectId: string | undefined,
): Promise<BatchUploadItemResult> {
  const supabase = await createClient();
  const context = await loadUploaderContext(supabase);
  if ("error" in context) {
    return { fileName: file.name, status: "error", message: context.error };
  }

  const result = await uploadOneHistoricalBoq(supabase, context.user, context.organisationId, file, projectId);
  if (result.status === "error") {
    return { fileName: file.name, status: "error", message: result.message };
  }
  return { fileName: file.name, status: "success", historicalBoqId: result.historicalBoqId };
}
