import type { EstimatorReportSummary, ExportLineItem, PricingConfidenceLevel } from "./types";

const CONFIDENCE_LEVELS: PricingConfidenceLevel[] = ["high", "medium", "low", "review_required"];

/**
 * Management-level summary of the pricing exercise (spec §3): counts and
 * values by how a rate was derived, plus a confidence breakdown. Every
 * number here is a sum/count over the already-resolved ExportLineItems —
 * nothing is recomputed or estimated independently, so this always agrees
 * with the detailed Priced BOQ sheet.
 */
export function buildEstimatorReportSummary(
  lineItems: ExportLineItem[],
  meta: { projectName: string; boqName: string; dateProcessed: string },
): EstimatorReportSummary {
  const confidenceBreakdown = Object.fromEntries(
    CONFIDENCE_LEVELS.map((level) => [level, { count: 0, value: 0 }]),
  ) as EstimatorReportSummary["confidenceBreakdown"];

  let totalBoqValue = 0;
  let pricedItems = 0;
  let reviewRequiredItems = 0;
  let historicalBenchmarkedCount = 0;
  let historicalBenchmarkedValue = 0;
  let marketResearchedCount = 0;
  let marketResearchedValue = 0;
  let reviewRequiredValue = 0;

  for (const item of lineItems) {
    const value = item.amount ?? 0;
    totalBoqValue += value;

    confidenceBreakdown[item.confidence].count += 1;
    confidenceBreakdown[item.confidence].value += value;

    if (item.isConfirmed) pricedItems += 1;

    if (item.pricingMethodKind === "historical" || item.pricingMethodKind === "system_suggested") {
      historicalBenchmarkedCount += 1;
      historicalBenchmarkedValue += value;
    }
    if (item.pricingMethodKind === "online") {
      marketResearchedCount += 1;
      marketResearchedValue += value;
    }
    if (item.confidence === "review_required" || !item.isConfirmed) {
      reviewRequiredItems += 1;
      reviewRequiredValue += value;
    }
  }

  return {
    projectName: meta.projectName,
    boqName: meta.boqName,
    dateProcessed: meta.dateProcessed,
    totalItems: lineItems.length,
    pricedItems,
    reviewRequiredItems,
    totalBoqValue,
    historicalBenchmarkedCount,
    historicalBenchmarkedValue,
    marketResearchedCount,
    marketResearchedValue,
    reviewRequiredValue,
    confidenceBreakdown,
  };
}
