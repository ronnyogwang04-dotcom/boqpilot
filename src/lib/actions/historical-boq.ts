"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { historicalLibraryConfig } from "@/config/historical-boq";
import { historicalBoqUploadSchema } from "@/lib/validations/historical-boq";
import { resolveSourceType } from "@/lib/historical-boq/parsers/registry";
import { processHistoricalBoq } from "@/lib/historical-boq/process-historical-boq";
import type { ActionState } from "@/types/action-state";

export async function uploadHistoricalBoq(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to upload a BOQ." };
  }

  const parsed = historicalBoqUploadSchema.safeParse({ projectId: formData.get("projectId") });
  if (!parsed.success) {
    return { status: "error", message: "Select a project before uploading." };
  }
  const { projectId } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please choose a file to upload." };
  }

  const maxBytes = historicalLibraryConfig.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { status: "error", message: `File is too large (max ${historicalLibraryConfig.maxUploadSizeMb}MB).` };
  }

  const sourceType = resolveSourceType(file.name, file.type);
  if (!sourceType) {
    return { status: "error", message: "Unsupported file type. Please upload an Excel file (.xlsx or .xls)." };
  }
  if (sourceType !== "excel") {
    return {
      status: "error",
      message: `${sourceType === "pdf" ? "PDF" : "Word"} historical BOQs aren't supported yet — please upload an Excel file (.xlsx or .xls).`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { status: "error", message: "Could not load your profile." };
  }

  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).single();
  if (!project) {
    return { status: "error", message: "Project not found." };
  }

  const historicalBoqId = randomUUID();
  const storagePath = `${profile.organisation_id}/${historicalBoqId}/${file.name}`;

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
      organisation_id: profile.organisation_id,
      project_id: projectId,
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
      project_id: projectId,
      status: "UPLOADED",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { status: "error", message: "Upload saved, but could not start processing. Please try again." };
  }

  await processHistoricalBoq(supabase, job.id);

  await logAuditEvent(supabase, {
    organisationId: profile.organisation_id,
    actorUserId: user.id,
    eventType: "upload",
    entityType: "historical_boq",
    entityId: historicalBoq.id,
    metadata: { project_id: projectId, filename: file.name },
  });

  redirect(`/dashboard/historical-library/uploads/${historicalBoq.id}`);
}
