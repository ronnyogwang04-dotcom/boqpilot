"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseSemanticSearchRepository } from "@/lib/embeddings/semantic-search";
import { getHistoricalBenchmarksBatch } from "@/lib/boq-pricing/benchmark-batch";
import { createSupabaseMarketResearchRepository, type PersistedEvidence } from "@/lib/boq-pricing/market-research/repository";
import { getMarketResearchProvider } from "@/lib/boq-pricing/market-research/provider";
import { researchLineItem, getLineItemMarketEvidence } from "@/lib/boq-pricing/market-research/service";
import { recommendMarketResearch } from "@/lib/boq-pricing/market-research/policy";
import type { MarketResearchResult } from "@/lib/boq-pricing/market-research/types";
import type { ActionState } from "@/types/action-state";
import type { MarketPricingBasis, MarketVatStatus } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

async function getAuthedOrgUser(): Promise<{ supabase: SupabaseClient<Database>; userId: string; organisationId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
  if (!profile) return null;
  return { supabase, userId: user.id, organisationId: profile.organisation_id };
}

export type MarketResearchLookupResult = { ok: true; result: MarketResearchResult } | { ok: false; error: string };

/**
 * On-demand market research for one line item — mirrors getLineItemBenchmark
 * (boq-pricing.ts): called from the estimator UI when the panel is opened or
 * "Research market price" is clicked, never precomputed for a whole BOQ.
 * Transparently reuses a fresh cached run when one exists (service.ts) — a
 * second click within the cache window never re-runs the search.
 */
export async function researchMarketPrice(lineItemId: string): Promise<MarketResearchLookupResult> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  const provider = getMarketResearchProvider();
  try {
    const result = await researchLineItem(repo, provider, lineItemId, auth.userId);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not run market research." };
  }
}

/** Explicit "Refresh Market Research" (spec §14) — bypasses the cache, never overwrites a previously saved estimator decision. */
export async function refreshMarketPrice(lineItemId: string): Promise<MarketResearchLookupResult> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  const provider = getMarketResearchProvider();
  try {
    const result = await researchLineItem(repo, provider, lineItemId, auth.userId, { forceRefresh: true });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not refresh market research." };
  }
}

export type EvidenceListResult = { ok: true; evidence: PersistedEvidence[] } | { ok: false; error: string };

/** Read-only: every persisted evidence row (web-research + manual) for a line item, no provider call. */
export async function getMarketEvidence(lineItemId: string): Promise<EvidenceListResult> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  try {
    const evidence = await getLineItemMarketEvidence(repo, lineItemId);
    return { ok: true, evidence };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not load market evidence." };
  }
}

const MANUAL_PRICING_BASES: MarketPricingBasis[] = ["each", "metre", "length", "pack", "box", "kg", "tonne", "litre", "m2", "m3", "day", "hour", "other"];
const MANUAL_VAT_STATUSES: MarketVatStatus[] = ["inclusive", "exclusive", "unknown"];

/** Estimator-entered supplier quote (spec §28) — a contractor's own direct quote may beat any online retail price; stored alongside web evidence in the same table. */
export async function saveManualMarketEvidence(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { status: "error", message: "You must be signed in." };

  const lineItemId = String(formData.get("lineItemId") ?? "");
  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const priceRaw = formData.get("sourcePrice");
  const price = typeof priceRaw === "string" ? Number(priceRaw) : NaN;
  const pricingBasis = String(formData.get("pricingBasis") ?? "");
  const vatStatus = String(formData.get("vatStatus") ?? "unknown");
  const quoteReference = String(formData.get("quoteReference") ?? "").trim() || null;
  const quoteDate = String(formData.get("quoteDate") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!lineItemId) return { status: "error", message: "Missing line item." };
  if (!supplierName) return { status: "error", message: "Supplier name is required." };
  if (!Number.isFinite(price) || price < 0) return { status: "error", message: "Enter a valid non-negative price." };
  if (!MANUAL_PRICING_BASES.includes(pricingBasis as MarketPricingBasis)) return { status: "error", message: "Choose a valid pricing basis." };
  if (!MANUAL_VAT_STATUSES.includes(vatStatus as MarketVatStatus)) return { status: "error", message: "Choose a valid VAT status." };

  const { data: item } = await auth.supabase.from("boq_line_items").select("organisation_id, project_id, boq_id").eq("id", lineItemId).single();
  if (!item) return { status: "error", message: "Line item not found." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  try {
    await repo.insertManualEvidence(
      { organisationId: item.organisation_id, projectId: item.project_id, lineItemId },
      {
        supplierName,
        quoteReference,
        sourcePrice: price,
        pricingBasis: pricingBasis as MarketPricingBasis,
        vatStatus: vatStatus as MarketVatStatus,
        sourceDate: quoteDate,
        notes,
      },
      auth.userId,
    );
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not save the manual quote." };
  }

  revalidatePath(`/dashboard/projects/${item.project_id}/boq/${item.boq_id}/items`);
  return { status: "success", message: "Manual supplier quote saved." };
}

/** Accept/reject one piece of evidence (spec §28) — never deletes it, so the audit trail stays intact even for rejected sources. */
export async function setMarketEvidenceAcceptance(evidenceId: string, isAccepted: boolean, rejectionReason: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  try {
    await repo.setEvidenceAccepted(evidenceId, isAccepted, rejectionReason);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update this evidence." };
  }
}

export type BatchCandidate = { id: string; description: string; reason: string };

/**
 * Precount for batch market research (spec §13) — computes which items the
 * historical-first policy recommends researching (weak/no historical match,
 * or a likely key/high-risk material) without ever calling the market
 * research provider itself. The UI shows this count before the user
 * confirms a batch run.
 */
export async function getMarketResearchBatchCandidates(boqId: string): Promise<{ ok: true; candidates: BatchCandidate[] } | { ok: false; error: string }> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const { data: items } = await auth.supabase
    .from("boq_line_items")
    .select("id, description, normalised_description, unit, normalised_unit")
    .eq("boq_id", boqId)
    .eq("row_type", "rate_item");
  if (!items || items.length === 0) return { ok: true, candidates: [] };

  const repo = createSupabaseSemanticSearchRepository(auth.supabase);
  const benchmarks = await getHistoricalBenchmarksBatch(
    repo,
    auth.organisationId,
    items.map((item) => ({ id: item.id, description: item.normalised_description ?? item.description, unit: item.normalised_unit ?? item.unit })),
  );

  const candidates: BatchCandidate[] = [];
  for (const item of items) {
    const benchmark = benchmarks.get(item.id);
    const recommendation = recommendMarketResearch(benchmark?.confidence ?? "none", item.description);
    if (recommendation.recommended) {
      candidates.push({ id: item.id, description: item.description, reason: recommendation.reason });
    }
  }
  return { ok: true, candidates };
}

export type BatchResearchOutcome = { id: string; status: "complete" | "no_result" | "needs_review" | "failed"; error: string | null };

/**
 * Runs market research over an explicit, user-confirmed list of line item
 * ids — never the whole BOQ implicitly (spec §13, §32: no automatic mass
 * research). Each item is independent: one failure is recorded and
 * processing continues with the rest (spec §27), never aborting the batch.
 */
export async function researchMarketPriceBatch(lineItemIds: string[]): Promise<{ ok: true; outcomes: BatchResearchOutcome[] } | { ok: false; error: string }> {
  const auth = await getAuthedOrgUser();
  if (!auth) return { ok: false, error: "You must be signed in." };

  const repo = createSupabaseMarketResearchRepository(auth.supabase);
  const provider = getMarketResearchProvider();
  const outcomes: BatchResearchOutcome[] = [];

  for (const lineItemId of lineItemIds) {
    try {
      const result = await researchLineItem(repo, provider, lineItemId, auth.userId);
      const status = result.status === "pending" || result.status === "researching" ? "failed" : result.status;
      outcomes.push({ id: lineItemId, status, error: result.errorMessage });
    } catch (err) {
      outcomes.push({ id: lineItemId, status: "failed", error: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  return { ok: true, outcomes };
}
