import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { historicalLibraryConfig } from "@/config/historical-boq";
import { normaliseDescription } from "@/lib/construction-intelligence/normalise-description";
import { normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import { buildDuplicateGroupKey } from "@/lib/construction-intelligence/duplicate-key";
import { classifyHierarchical } from "@/lib/construction-intelligence/category-hierarchy";
import { resolveCanonicalItemIds } from "@/lib/construction-intelligence/resolve-canonical-items";
import { extractItemsFromDocument } from "./extractor";
import { getParserForSourceType } from "./parsers/registry";

/**
 * The single seam a future queue consumer would call instead of the upload
 * Server Action calling it inline — nothing else in this pipeline would need
 * to change to move this off the request path.
 *
 * Never throws: any failure is captured on the job row (status FAILED,
 * failure_reason) so the caller can always redirect to the result page.
 */
export async function processHistoricalBoq(supabase: SupabaseClient<Database>, jobId: string): Promise<void> {
  const { data: job, error: jobError } = await supabase
    .from("historical_boq_processing_jobs")
    .select("id, historical_boq_id, project_id")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    console.error("processHistoricalBoq: job not found", jobId, jobError?.message);
    return;
  }

  const { data: historicalBoq, error: boqError } = await supabase
    .from("historical_boqs")
    .select("id, organisation_id, project_id, source_type, storage_path, created_at")
    .eq("id", job.historical_boq_id)
    .single();

  if (boqError || !historicalBoq) {
    await failJob(supabase, jobId, "Could not load the uploaded file's record.");
    return;
  }

  try {
    await supabase
      .from("historical_boq_processing_jobs")
      .update({ status: "PARSING", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId);

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("historical-boqs")
      .download(historicalBoq.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Could not download the uploaded file from storage.");
    }

    const parser = getParserForSourceType(historicalBoq.source_type);
    const buffer = await fileBlob.arrayBuffer();
    const document = await parser.parse(buffer);

    const totalRawRows = document.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    if (totalRawRows > historicalLibraryConfig.maxRowsPerFile) {
      throw new Error(
        `This file has more than ${historicalLibraryConfig.maxRowsPerFile.toLocaleString()} rows. Please split it into smaller files and upload them separately.`,
      );
    }

    await supabase
      .from("historical_boq_processing_jobs")
      .update({ status: "VALIDATING", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    const { items, summary } = extractItemsFromDocument(document);

    if (items.length === 0) {
      throw new Error(
        "No BOQ table could be found in this file. Make sure it has a header row with a Description column.",
      );
    }

    // Construction Intelligence Layer: deterministically normalise each
    // genuine rate-bearing item and resolve it to a canonical
    // rate_library_items row before insert — this is the seam between raw
    // extraction and the future embedding service, which will only ever
    // read normalised_description off rate_library_items, never
    // historical_boq_items directly.
    //
    // Non-rate-bearing rows (headings, subtotals, notes, contractual text —
    // row_type !== "rate_item") and rows the extractor couldn't parse at
    // all (status "error") are stored for audit but deliberately excluded
    // here: they must never enter the canonical rate library or influence
    // benchmarking (see row-type.ts).
    const canonicalisableItems = items.filter((item) => item.rowType === "rate_item" && item.status !== "error");

    const canonicalInputByItem = new Map(
      canonicalisableItems.map((item) => {
        const normalisedDescription = normaliseDescription(item.description);
        const normalisedUnit = normaliseUnit(item.unit);
        const { division, category } = classifyHierarchical(item.description, item.section);
        return [
          item,
          {
            normalisedDescription,
            normalisedUnit,
            division,
            category,
            duplicateKey: buildDuplicateGroupKey(normalisedDescription, normalisedUnit),
          },
        ] as const;
      }),
    );

    const canonicalIdByKey = await resolveCanonicalItemIds(
      supabase,
      historicalBoq.organisation_id,
      [...canonicalInputByItem.values()],
    );

    const rows = items.map((item) => {
      const canonicalInput = canonicalInputByItem.get(item);
      const canonicalItemId = canonicalInput ? canonicalIdByKey.get(canonicalInput.duplicateKey) ?? null : null;

      return {
        organisation_id: historicalBoq.organisation_id,
        project_id: historicalBoq.project_id,
        historical_boq_id: historicalBoq.id,
        uploaded_at: historicalBoq.created_at,
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
        canonical_item_id: canonicalItemId,
      };
    });

    let insertedCount = 0;
    try {
      for (let i = 0; i < rows.length; i += historicalLibraryConfig.insertBatchSize) {
        const chunk = rows.slice(i, i + historicalLibraryConfig.insertBatchSize);
        const { error: insertError } = await supabase.from("historical_boq_items").insert(chunk);
        if (insertError) throw new Error(insertError.message);
        insertedCount += chunk.length;
      }
    } catch (insertError) {
      // Compensate rather than leave a partial import behind.
      await supabase.from("historical_boq_items").delete().eq("historical_boq_id", historicalBoq.id);
      throw insertError;
    }

    const touchedCanonicalIds = [...new Set(rows.map((row) => row.canonical_item_id).filter((id): id is string => id !== null))];
    if (touchedCanonicalIds.length > 0) {
      const { error: statsError } = await supabase.rpc("recompute_rate_library_stats", {
        p_canonical_ids: touchedCanonicalIds,
      });
      // Stats are a derived/materialised rollup, not the source of truth —
      // a failure here shouldn't fail the whole upload; it can be
      // recomputed later from historical_boq_items at any time.
      if (statsError) console.error("recompute_rate_library_stats failed:", statsError.message);
    }

    const sampleErrors = items
      .filter((item) => item.status !== "ok")
      .slice(0, 20)
      .map((item) => ({ rowNumber: item.rowNumber, description: item.description, errors: item.validationErrors }));

    const finalStatus = summary.rowsNeedsReview > 0 || summary.rowsError > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";

    await supabase
      .from("historical_boq_processing_jobs")
      .update({
        status: finalStatus,
        rows_detected: summary.rowsDetected,
        rows_extracted: insertedCount,
        rows_needs_review: summary.rowsNeedsReview,
        rows_error: summary.rowsError,
        error_summary: sampleErrors.length > 0 ? (sampleErrors as unknown as Json) : null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (error) {
    await failJob(supabase, jobId, error instanceof Error ? error.message : "Unknown processing error.");
  }
}

async function failJob(supabase: SupabaseClient<Database>, jobId: string, reason: string): Promise<void> {
  await supabase
    .from("historical_boq_processing_jobs")
    .update({
      status: "FAILED",
      failure_reason: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
