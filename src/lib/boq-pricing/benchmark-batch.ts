import type { SemanticSearchRepository } from "@/lib/embeddings/semantic-search";
import { searchSimilarItemsBatch, type BatchSemanticSearchQuery } from "@/lib/embeddings/semantic-search-batch";
import { classifyConfidence } from "./confidence";
import type { HistoricalBenchmarkResult } from "./benchmark";

const EVIDENCE_LIMIT = 5;

export type BenchmarkBatchItem = { id: string; description: string; unit: string | null };

/**
 * Batched sibling of getHistoricalBenchmark (benchmark.ts) — same
 * confidence classification applied on top of the same read-only search,
 * just run once for many line items via searchSimilarItemsBatch instead of
 * once per item. Used only by the Excel export path to price the current
 * BOQ's un-reviewed rows; the interactive per-row UI keeps using the
 * single-item getHistoricalBenchmark. Never writes to rate_library_items or
 * boq_line_items itself — persisting the result as a cached suggestion is
 * the caller's responsibility.
 */
export async function getHistoricalBenchmarksBatch(
  repo: SemanticSearchRepository,
  organisationId: string,
  items: BenchmarkBatchItem[],
): Promise<Map<string, HistoricalBenchmarkResult>> {
  const queries: BatchSemanticSearchQuery[] = items.map((item) => ({ id: item.id, description: item.description, unitHint: item.unit }));
  const searchResults = await searchSimilarItemsBatch(repo, organisationId, queries, { limit: EVIDENCE_LIMIT });

  const benchmarks = new Map<string, HistoricalBenchmarkResult>();
  for (const item of items) {
    const search = searchResults.get(item.id) ?? { results: [], inferredCategory: null, inferredUnit: null };
    const bestMatch = search.results[0] ?? null;
    benchmarks.set(item.id, {
      confidence: classifyConfidence(bestMatch, item.unit),
      bestMatch,
      evidence: search.results.slice(1),
      inferredCategory: search.inferredCategory,
      inferredUnit: search.inferredUnit,
    });
  }
  return benchmarks;
}
