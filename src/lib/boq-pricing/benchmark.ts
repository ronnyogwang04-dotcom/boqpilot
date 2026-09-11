import type { SemanticSearchRepository, SemanticSearchResult } from "@/lib/embeddings/semantic-search";
import { searchSimilarItems } from "@/lib/embeddings/semantic-search";
import { classifyConfidence, type BenchmarkConfidence } from "./confidence";

const EVIDENCE_LIMIT = 5;

export type HistoricalBenchmarkResult = {
  confidence: BenchmarkConfidence;
  bestMatch: SemanticSearchResult | null;
  /** Top matches beyond the best one, for the estimator to inspect ("view underlying evidence"). */
  evidence: SemanticSearchResult[];
  inferredCategory: string | null;
  inferredUnit: string | null;
};

/**
 * Thin wrapper around the existing, already-tested Phase 4 semantic search
 * (src/lib/embeddings/semantic-search.ts) — no search/ranking logic is
 * duplicated here, only confidence classification on top of its results.
 * Read-only: never writes to rate_library_items, never merges/alters
 * canonical items. The current BOQ item is only ever a query — it's never
 * inserted anywhere the historical library could pick it up as evidence.
 */
export async function getHistoricalBenchmark(
  repo: SemanticSearchRepository,
  organisationId: string,
  item: { description: string; unit: string | null },
): Promise<HistoricalBenchmarkResult> {
  const { results, inferredCategory, inferredUnit } = await searchSimilarItems(
    repo,
    organisationId,
    { description: item.description, unitHint: item.unit },
    { limit: EVIDENCE_LIMIT },
  );

  const bestMatch = results[0] ?? null;
  const confidence = classifyConfidence(bestMatch, item.unit);

  return {
    confidence,
    bestMatch,
    evidence: results.slice(1),
    inferredCategory,
    inferredUnit,
  };
}
