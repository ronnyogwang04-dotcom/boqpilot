// Which canonical items are allowed into the embedding process, and what
// state their embedding is currently in.

export type EligibilityInput = {
  mergedIntoId: string | null;
  sampleCount: number;
};

/**
 * A canonical item is eligible iff it's not merged away and has at least
 * one genuinely priced source row — identical to Rate Explorer's existing
 * "real item" filter (listRateLibraryItems: `.gt("sample_count", 0)`).
 * This alone is sufficient to exclude non-rate rows, headings, VAT,
 * subtotals, and needs-review-only items: sample_count only counts
 * historical_boq_items rows with a non-null unit_rate, and only
 * `row_type === "rate_item" && status !== "error"` rows ever get a
 * canonical_item_id in the first place (process-historical-boq.ts) — so
 * ineligible row types never reach rate_library_items at all, and a
 * canonical item with zero priced samples is excluded here.
 */
export function isEligibleForEmbedding(item: EligibilityInput): boolean {
  return item.mergedIntoId === null && item.sampleCount > 0;
}

export type EmbeddingStatus = "pending" | "current" | "stale" | "failed";

export type EmbeddingStatusInput = {
  embedding: unknown;
  embeddingInputText: string | null;
  embeddingLastError: string | null;
};

/**
 * Derived status — no separate status column to drift out of sync with
 * reality. `failed` takes priority over `pending`/`stale` so a retry
 * candidate is visibly distinguished from one that's simply never been
 * attempted, even though both currently lack a usable embedding.
 */
export function classifyEmbeddingStatus(item: EmbeddingStatusInput, candidateInputText: string): EmbeddingStatus {
  const hasEmbedding = item.embedding !== null && item.embedding !== undefined;

  if (!hasEmbedding) {
    return item.embeddingLastError ? "failed" : "pending";
  }
  if (item.embeddingInputText !== candidateInputText) {
    return "stale";
  }
  return "current";
}

/** Needs a (re-)embedding API call — anything not already current. */
export function needsEmbedding(item: EmbeddingStatusInput, candidateInputText: string): boolean {
  return classifyEmbeddingStatus(item, candidateInputText) !== "current";
}
