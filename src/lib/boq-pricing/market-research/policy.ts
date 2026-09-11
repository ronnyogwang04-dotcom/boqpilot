import { SPECIALIST_KEYWORD_FLAGS } from "../export/key-item-flags";
import type { BenchmarkConfidence } from "../confidence";

/** Reuses the same "commercially risky to price wrong" keyword list the Review & Double-Check export already flags key items with (spec §19) — one list, not two. */
export function isLikelyKeyMaterial(description: string): boolean {
  const text = description.toLowerCase();
  return SPECIALIST_KEYWORD_FLAGS.some(({ keyword }) => text.includes(keyword));
}

export type MarketResearchRecommendation = { recommended: boolean; reason: string };

/**
 * The historical-first policy (spec §12): market research is never
 * triggered automatically by this function — it only tells the UI/export
 * whether to *recommend* the estimator run it. The estimator (or an
 * explicit "Research this item" click) always remains the actual trigger.
 */
export function recommendMarketResearch(benchmarkConfidence: BenchmarkConfidence, description: string): MarketResearchRecommendation {
  if (benchmarkConfidence === "none") {
    return { recommended: true, reason: "No historical benchmark found — market research is the primary evidence source for this item." };
  }
  if (benchmarkConfidence === "weak") {
    return { recommended: true, reason: "Historical benchmark is weak — a market cross-check is recommended." };
  }
  if (isLikelyKeyMaterial(description)) {
    return { recommended: true, reason: "This looks like a high-value/high-risk or key material item — a market cross-check is recommended even though historical evidence exists." };
  }
  if (benchmarkConfidence === "reasonable") {
    return { recommended: false, reason: "Reasonable historical benchmark exists — market research may still be used as an optional cross-check." };
  }
  return { recommended: false, reason: "Strong historical benchmark exists — market research is not necessary unless you want to double-check." };
}
