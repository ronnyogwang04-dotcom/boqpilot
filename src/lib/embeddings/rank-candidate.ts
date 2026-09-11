// Combines raw vector similarity with deterministic construction-context
// signals (unit, category) so semantic search doesn't rely on the embedding
// model alone. Vector similarity stays dominant — these are soft nudges,
// not hard filters, since a hard filter would exclude genuinely relevant
// cross-unit/cross-category variants a human reviewer would still want to
// see (e.g. the same fitting priced as "No" in one BOQ and "Item" in
// another). A unit MISMATCH is penalised more than a category mismatch:
// in construction pricing two rows with the same wording but different
// units almost always describe different real-world scopes (e.g. "Supply
// pipe" priced per metre vs. per each), whereas the same activity
// legitimately recurs across categories (e.g. "supply and install access
// panel" in both Building Services and Finishes).
export const searchRankingConfig = {
  unitMatchBonus: 0.05,
  unitMismatchPenalty: 0.05,
  categoryMatchBonus: 0.03,
  categoryMismatchPenalty: 0.02,
};

export type RankingCandidate = {
  normalisedUnit: string | null;
  category: string | null;
};

export type RankingContext = {
  /** Already normalised via normaliseUnit(), or null if the searcher didn't provide one. */
  unitHint: string | null;
  /** Auto-classified from the query text via classifyHierarchical(), or null if uncategorised. */
  category: string | null;
};

/**
 * Returns the combined ranking score for one candidate. `similarity` is the
 * raw cosine similarity (0..1-ish for text-embedding-3-small); the result
 * is not clamped, since it's only ever used for relative sorting, never
 * displayed as-is (the UI shows `similarity` separately, unmodified).
 */
export function scoreCandidate(similarity: number, candidate: RankingCandidate, context: RankingContext): number {
  let score = similarity;

  if (context.unitHint && candidate.normalisedUnit) {
    score +=
      candidate.normalisedUnit.toLowerCase() === context.unitHint.toLowerCase()
        ? searchRankingConfig.unitMatchBonus
        : -searchRankingConfig.unitMismatchPenalty;
  }

  if (context.category && candidate.category) {
    score +=
      candidate.category === context.category
        ? searchRankingConfig.categoryMatchBonus
        : -searchRankingConfig.categoryMismatchPenalty;
  }

  return score;
}
