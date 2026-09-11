import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { boqPricingConfig } from "@/config/boq-pricing";
import { normaliseDescription } from "@/lib/construction-intelligence/normalise-description";
import { normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import { classifyHierarchical } from "@/lib/construction-intelligence/category-hierarchy";
import { extractCurrentBoqItems } from "./extract";

// Only these two errors are safe to show verbatim — specific, actionable,
// and reveal nothing about implementation. Every other failure (storage
// errors, database errors, OpenAI errors, unexpected exceptions) is logged
// in full server-side and replaced with GENERIC_FAILURE_MESSAGE before it
// ever reaches processing_jobs.failure_reason, which the UI displays as-is.
class SafeProcessingError extends Error {}

const GENERIC_FAILURE_MESSAGE =
  "We couldn't process this BOQ. Please check that the file is a valid PDF or Excel BOQ and try again. If the problem continues, contact support.";

/**
 * The current-pricing mirror of processHistoricalBoq() — same "no queue
 * worker, run inline, never throw" convention. Writes ONLY to boq_line_items
 * (and processing_jobs' own status columns); never touches
 * historical_boq_items, rate_library_items, normalised_description, or
 * duplicate_group_key on the historical side. The current BOQ never becomes
 * historical data — nothing here inserts into any historical-library table.
 */
export async function processCurrentBoq(supabase: SupabaseClient<Database>, boqId: string): Promise<void> {
  const { data: boq, error: boqError } = await supabase
    .from("boqs")
    .select("id, project_id, storage_path, source_format")
    .eq("id", boqId)
    .single();

  if (boqError || !boq || !boq.project_id) {
    console.error("processCurrentBoq: boq not found", boqId, boqError?.message);
    return;
  }
  const projectId = boq.project_id;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("organisation_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    await failJob(supabase, boqId, "Could not resolve this BOQ's organisation.");
    return;
  }

  if (!boq.storage_path || !boq.source_format) {
    await failJob(supabase, boqId, "No file is stored for this BOQ.");
    return;
  }

  const organisationId = project.organisation_id;

  try {
    await updateStatus(supabase, boqId, "PREPARING_DOCUMENT", { started_at: new Date().toISOString() });

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("pricing-boqs")
      .download(boq.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Could not download the uploaded file from storage.");
    }

    await updateStatus(supabase, boqId, "AI_EXTRACTION");

    const buffer = await fileBlob.arrayBuffer();
    const { items, summary } = await extractCurrentBoqItems({ buffer, sourceFormat: boq.source_format });

    if (items.length === 0) {
      throw new SafeProcessingError("No BOQ line items could be found in this file.");
    }
    if (items.length > boqPricingConfig.maxRowsPerFile) {
      throw new SafeProcessingError(
        `This file has more than ${boqPricingConfig.maxRowsPerFile.toLocaleString()} rows. Please split it into smaller files and upload them separately.`,
      );
    }

    await updateStatus(supabase, boqId, "NORMALISING_DATA");

    // Deterministic normalisation, computed and stored ONLY on
    // boq_line_items — this is a completely separate table from
    // rate_library_items, so nothing here can corrupt canonical historical
    // items or their duplicate_group_key.
    const rows = items.map((item) => {
      const isRateItem = item.rowType === "rate_item" && item.status !== "error";
      const normalisedDescription = isRateItem ? normaliseDescription(item.description) : null;
      const normalisedUnit = isRateItem ? normaliseUnit(item.unit) : null;
      const hierarchical = isRateItem ? classifyHierarchical(normalisedDescription ?? item.description, item.section) : null;

      return {
        organisation_id: organisationId,
        project_id: projectId,
        boq_id: boqId,
        row_number: item.rowNumber,
        row_type: item.rowType,
        section: item.section,
        item_code: item.itemCode,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_rate: item.unitRate,
        amount: item.amount,
        category: item.category,
        status: item.status,
        validation_errors: item.validationErrors as Json | null,
        raw_row: item.rawRow as Json,
        source_format: boq.source_format!,
        normalised_description: normalisedDescription,
        normalised_unit: normalisedUnit,
        category_division: hierarchical?.division ?? null,
        construction_category: hierarchical?.category ?? null,
      };
    });

    try {
      for (let i = 0; i < rows.length; i += boqPricingConfig.insertBatchSize) {
        const chunk = rows.slice(i, i + boqPricingConfig.insertBatchSize);
        const { error: insertError } = await supabase.from("boq_line_items").insert(chunk);
        if (insertError) throw new Error(insertError.message);
      }
    } catch (insertError) {
      // Compensate rather than leave a partial import behind.
      await supabase.from("boq_line_items").delete().eq("boq_id", boqId);
      throw insertError;
    }

    await supabase
      .from("processing_jobs")
      .update({
        status: "COMPLETED",
        progress: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        failure_reason:
          summary.rowsError > 0
            ? `Completed with ${summary.rowsError} row(s) that failed extraction — see line items for details.`
            : null,
      })
      .eq("boq_id", boqId);
  } catch (error) {
    // Full detail (OpenAI errors, Supabase errors, stack traces) goes to
    // server logs only — never into failure_reason, which the UI renders
    // directly to the user.
    console.error("processCurrentBoq failed", { boqId }, error);
    const message = error instanceof SafeProcessingError ? error.message : GENERIC_FAILURE_MESSAGE;
    await failJob(supabase, boqId, message);
  }
}

async function updateStatus(
  supabase: SupabaseClient<Database>,
  boqId: string,
  status: "PREPARING_DOCUMENT" | "AI_EXTRACTION" | "NORMALISING_DATA",
  extra: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from("processing_jobs")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("boq_id", boqId);
}

async function failJob(supabase: SupabaseClient<Database>, boqId: string, reason: string): Promise<void> {
  await supabase
    .from("processing_jobs")
    .update({
      status: "FAILED",
      failure_reason: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("boq_id", boqId);
}
