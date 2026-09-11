import { MARKET_EVIDENCE_CLASSIFICATION_LABELS } from "./types";
import type { NormalisedMarketEvidence } from "./types";

export type MaterialCostGuidance =
  | { usableAsMaterialCost: true; materialCost: number; unit: string }
  | { usableAsMaterialCost: false; reason: string };

/**
 * Whether one piece of market evidence may feed the existing cost-buildup.ts
 * "Material" component directly. Only a genuine material/product or
 * supply-only price qualifies — a supply-and-install or installed/service
 * rate already bundles labour and must never be dropped straight into
 * "Material" without adjustment (spec §5, §16: never treat retail material
 * cost as an installed rate, never invent labour/plant costs to make up the
 * difference). This function never fabricates a labour/plant allowance; it
 * only says whether the material line itself is safe to populate.
 */
export function evidenceToMaterialCostGuidance(evidence: NormalisedMarketEvidence): MaterialCostGuidance {
  if (evidence.sourcePrice === null) {
    return { usableAsMaterialCost: false, reason: "Price not published — supplier quotation required before this can be used as a material cost." };
  }
  if (evidence.normalisedPrice === null || evidence.normalisedUnit === null) {
    return { usableAsMaterialCost: false, reason: "This evidence could not be unit-normalised — do not use it as a material cost input." };
  }
  if (!evidence.verified) {
    return { usableAsMaterialCost: false, reason: "This source's URL was not confirmed by the web search tool's own citations — verify it manually before using it." };
  }
  if (evidence.evidenceClassification === "material_product_price" || evidence.evidenceClassification === "supply_only_price") {
    return { usableAsMaterialCost: true, materialCost: evidence.normalisedPrice, unit: evidence.normalisedUnit };
  }
  return {
    usableAsMaterialCost: false,
    reason: `This evidence is classified as "${MARKET_EVIDENCE_CLASSIFICATION_LABELS[evidence.evidenceClassification]}", not a material/product price — it may already include labour/installation cost, so it should not be used as the Material line in the cost build-up without adjustment.`,
  };
}
