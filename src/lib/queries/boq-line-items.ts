import { createClient } from "@/lib/supabase/server";
import type { BoqLineItemRateSource, Json } from "@/types/database.types";

export type BoqLineItemRow = {
  id: string;
  row_number: number;
  section: string | null;
  item_code: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  unit_rate: number | null;
  amount: number | null;
  normalised_description: string | null;
  normalised_unit: string | null;
  category_division: string | null;
  construction_category: string | null;
  estimator_rate: number | null;
  rate_source: BoqLineItemRateSource | null;
  rate_notes: string | null;
  cost_buildup_components: Json | null;
  cost_buildup_markups: Json | null;
  benchmark_snapshot: Json | null;
  system_suggested_snapshot: Json | null;
  system_suggested_at: string | null;
  market_research_snapshot: Json | null;
};

const COLUMNS =
  "id, row_number, section, item_code, description, unit, quantity, unit_rate, amount, normalised_description, normalised_unit, category_division, construction_category, estimator_rate, rate_source, rate_notes, cost_buildup_components, cost_buildup_markups, benchmark_snapshot, system_suggested_snapshot, system_suggested_at, market_research_snapshot";

/**
 * Only genuine rate-bearing rows — headings/subtotals/notes are stored on
 * boq_line_items for audit but never shown on the estimator's pricing grid.
 * RLS (organisation_id = current_organisation_id()) is the only access
 * check; this file adds no additional scoping beyond the boq_id filter.
 */
export async function listBoqRateItems(boqId: string): Promise<BoqLineItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boq_line_items")
    .select(COLUMNS)
    .eq("boq_id", boqId)
    .eq("row_type", "rate_item")
    .order("row_number");

  if (error || !data) return [];
  return data;
}

export type BoqPricingProgress = { totalRateItems: number; pricedRateItems: number };

/**
 * Lightweight aggregate for the project workspace stepper — how far along
 * estimator pricing is for a BOQ, without pulling every line item. Pricing
 * has no dedicated job-status stage (see processing_jobs.status); "priced"
 * is defined the same way saveEstimatorDecision defines it: estimator_rate
 * saved, priced_at set.
 */
export async function getBoqPricingProgress(boqId: string): Promise<BoqPricingProgress> {
  const supabase = await createClient();
  const [{ count: total }, { count: priced }] = await Promise.all([
    supabase
      .from("boq_line_items")
      .select("id", { count: "exact", head: true })
      .eq("boq_id", boqId)
      .eq("row_type", "rate_item"),
    supabase
      .from("boq_line_items")
      .select("id", { count: "exact", head: true })
      .eq("boq_id", boqId)
      .eq("row_type", "rate_item")
      .not("priced_at", "is", null),
  ]);

  return { totalRateItems: total ?? 0, pricedRateItems: priced ?? 0 };
}
