"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseSemanticSearchRepository } from "@/lib/embeddings/semantic-search";
import { getHistoricalBenchmark, type HistoricalBenchmarkResult } from "@/lib/boq-pricing/benchmark";
import type { ActionState } from "@/types/action-state";
import type { BoqLineItemRateSource, Json } from "@/types/database.types";

export type BenchmarkLookupResult = { ok: true; benchmark: HistoricalBenchmarkResult } | { ok: false; error: string };

/**
 * On-demand, read-only historical benchmark for one line item — called from
 * the estimator UI when a row's benchmark panel is opened, not precomputed
 * for the whole BOQ up front. Never writes to boq_line_items or any
 * historical-library table.
 */
export async function getLineItemBenchmark(lineItemId: string): Promise<BenchmarkLookupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) return { ok: false, error: "Could not load your profile." };

  const { data: item, error } = await supabase
    .from("boq_line_items")
    .select("normalised_description, normalised_unit, description, unit")
    .eq("id", lineItemId)
    .single();
  if (error || !item) return { ok: false, error: "Line item not found." };

  const repo = createSupabaseSemanticSearchRepository(supabase);
  try {
    const benchmark = await getHistoricalBenchmark(repo, profile.organisation_id, {
      description: item.normalised_description ?? item.description,
      unit: item.normalised_unit ?? item.unit,
    });
    return { ok: true, benchmark };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not compute a historical benchmark." };
  }
}

const VALID_RATE_SOURCES: BoqLineItemRateSource[] = ["historical", "online", "build_up", "manual"];

/**
 * Best-effort JSON parse for the snapshot hidden fields — a malformed or
 * missing snapshot should never block saving the rate itself, it just means
 * the export won't have saved evidence for this row.
 */
function parseJsonField(value: FormDataEntryValue | null): Json | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value) as Json;
  } catch {
    return null;
  }
}

/**
 * The estimator's own decision — the only durable pricing state this phase
 * writes. Never set automatically by extraction, benchmarking, or the cost
 * build-up calculator; only this explicit save action ever touches it.
 *
 * Alongside the rate itself, this also snapshots whichever evidence backed
 * the chosen source (the cost build-up components/markups for "build_up",
 * the loaded historical benchmark for "historical", or the selected market
 * evidence for "online") so the Excel export can show real, saved reasoning
 * instead of re-deriving it later. A later refreshed market research run
 * never rewrites this saved snapshot (spec §21). The snapshot for every
 * *other* source is always cleared, so a row never shows
 * stale evidence for a source it's no longer priced from.
 */
export async function saveEstimatorDecision(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const lineItemId = String(formData.get("lineItemId") ?? "");
  if (!lineItemId) return { status: "error", message: "Missing line item." };

  const rawRate = formData.get("estimatorRate");
  const rateText = typeof rawRate === "string" ? rawRate.trim() : "";
  let rate: number | null = null;
  if (rateText !== "") {
    const parsed = Number(rateText);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { status: "error", message: "Enter a valid non-negative rate." };
    }
    rate = parsed;
  }

  const rawSource = String(formData.get("rateSource") ?? "");
  const rateSource = VALID_RATE_SOURCES.includes(rawSource as BoqLineItemRateSource) ? (rawSource as BoqLineItemRateSource) : null;
  if (rate !== null && !rateSource) {
    return { status: "error", message: "Choose where this rate came from (historical, online, build-up, or manual)." };
  }

  const notes = String(formData.get("rateNotes") ?? "").trim() || null;

  const costBuildupComponents = rate !== null && rateSource === "build_up" ? parseJsonField(formData.get("costBuildupComponents")) : null;
  const costBuildupMarkups = rate !== null && rateSource === "build_up" ? parseJsonField(formData.get("costBuildupMarkups")) : null;
  const benchmarkSnapshot = rate !== null && rateSource === "historical" ? parseJsonField(formData.get("benchmarkSnapshot")) : null;
  const marketResearchSnapshot = rate !== null && rateSource === "online" ? parseJsonField(formData.get("marketResearchSnapshot")) : null;

  const { data: item } = await supabase.from("boq_line_items").select("boq_id, project_id").eq("id", lineItemId).single();
  if (!item) return { status: "error", message: "Line item not found." };

  const { error } = await supabase
    .from("boq_line_items")
    .update({
      estimator_rate: rate,
      rate_source: rate !== null ? rateSource : null,
      rate_notes: notes,
      priced_at: rate !== null ? new Date().toISOString() : null,
      priced_by: rate !== null ? user.id : null,
      cost_buildup_components: costBuildupComponents,
      cost_buildup_markups: costBuildupMarkups,
      benchmark_snapshot: benchmarkSnapshot,
      market_research_snapshot: marketResearchSnapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineItemId);

  if (error) return { status: "error", message: "Could not save this rate. Please try again." };

  revalidatePath(`/dashboard/projects/${item.project_id}/boq/${item.boq_id}/items`);
  return { status: "success", message: rate !== null ? "Rate saved." : "Rate cleared." };
}
