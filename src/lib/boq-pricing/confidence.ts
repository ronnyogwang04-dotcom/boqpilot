import { normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import type { SemanticSearchResult } from "@/lib/embeddings/semantic-search";

export type BenchmarkConfidence = "strong" | "reasonable" | "weak" | "none";

export const CONFIDENCE_LABELS: Record<BenchmarkConfidence, string> = {
  strong: "Strong historical match",
  reasonable: "Reasonable historical match",
  weak: "Weak historical match",
  none: "No reliable historical benchmark found",
};

// Proposed defaults, calibrated from Phase 4's real observed similarity
// distribution against the live rate_library_items data: genuine matches
// (reinforced concrete, fence install/remove, geyser install/remove)
// clustered 0.71-0.80 similarity; weak/no-match cases (no genuine item
// exists) clustered 0.55-0.65 with generic, unrelated top results. These are
// defaults to validate against real dry-run data, not asserted as final —
// see confidence.test.ts and the Phase 5 validation report.
export const confidenceThresholds = {
  strongSimilarity: 0.75,
  reasonableSimilarity: 0.65,
  weakSimilarity: 0.55,
  strongMinSamples: 2,
};

/**
 * Unit compatibility is a hard requirement for Strong/Reasonable — a match
 * with the wrong unit can never look confident, however similar the wording
 * ("do not recommend an m² rate for an item priced per m"). It's still
 * shown as Weak rather than hidden outright: a soft demotion, not a filter,
 * consistent with the ranking design in rank-candidate.ts. A query with no
 * known unit (queryUnit null) can't penalise anything — there's nothing to
 * compare against.
 */
export function classifyConfidence(bestMatch: SemanticSearchResult | null, queryUnit: string | null): BenchmarkConfidence {
  if (!bestMatch) return "none";

  const normalisedQueryUnit = normaliseUnit(queryUnit);
  const unitCompatible =
    normalisedQueryUnit === null ||
    bestMatch.unit === null ||
    bestMatch.unit.toLowerCase() === normalisedQueryUnit.toLowerCase();

  if (bestMatch.similarity >= confidenceThresholds.strongSimilarity && unitCompatible && bestMatch.sampleCount >= confidenceThresholds.strongMinSamples) {
    return "strong";
  }
  if (bestMatch.similarity >= confidenceThresholds.reasonableSimilarity && unitCompatible) {
    return "reasonable";
  }
  if (bestMatch.similarity >= confidenceThresholds.weakSimilarity) {
    return "weak";
  }
  return "none";
}
