import { calculateCostBuildup, type CostBuildupLine } from "../cost-buildup";
import type { BenchmarkConfidence } from "../confidence";
import type { MarketEvidenceQuality } from "../market-research/types";
import type { ExportLineItem, ExportLineItemInput, PricingConfidenceLevel } from "./types";

const OVERHEAD_LABEL_PREFIXES = ["Site overheads", "Head office overheads", "Contingency"];
const PROFIT_LABEL_PREFIXES = ["Profit"];

function benchmarkConfidenceToLevel(confidence: BenchmarkConfidence): PricingConfidenceLevel {
  switch (confidence) {
    case "strong":
      return "high";
    case "reasonable":
      return "medium";
    case "weak":
      return "low";
    case "none":
      return "review_required";
  }
}

function marketConfidenceToLevel(confidence: MarketEvidenceQuality): PricingConfidenceLevel {
  switch (confidence) {
    case "strong":
      return "high";
    case "reasonable":
      return "medium";
    case "limited":
      return "low";
    case "none":
      return "review_required";
  }
}

function sumLinesWithPrefix(lines: CostBuildupLine[], prefixes: string[]): number | null {
  const matching = lines.filter((line) => prefixes.some((prefix) => line.label.startsWith(prefix)));
  if (matching.length === 0) return null;
  return matching.reduce((sum, line) => sum + line.amount, 0);
}

function bestRate(match: { avgRate: number | null; medianRate: number | null; mostRecentRate: number | null } | null): number | null {
  if (!match) return null;
  return match.avgRate ?? match.medianRate ?? match.mostRecentRate ?? null;
}

/**
 * Resolves everything the export needs about one BOQ line item's pricing:
 * which evidence backs it, a single "recommended rate", the cost build-up
 * breakdown (only when one was actually captured for THIS item — never a
 * blanket markup applied regardless of available information, per spec §7),
 * a plain-language pricing method label, and a confidence level. Every
 * field is either a persisted value, a deterministic recomputation of
 * persisted inputs (calculateCostBuildup, reused verbatim), or null — never
 * fabricated (spec §11).
 */
export function resolveExportLineItem(input: ExportLineItemInput): ExportLineItem {
  const isConfirmed = input.estimatorRate !== null && input.rateSource !== null;

  let recommendedRate: number | null = null;
  let historicalBenchmarkRate: number | null = null;
  let labourAllowance: number | null = null;
  let plantAllowance: number | null = null;
  let overheadsAmount: number | null = null;
  let profitAmount: number | null = null;
  let confidence: PricingConfidenceLevel = "review_required";
  let pricingMethodKind: ExportLineItem["pricingMethodKind"] = "insufficient_data";
  let pricingMethodLabel = "Insufficient data — manual review required";
  let benchmarkEvidence: ExportLineItem["benchmarkEvidence"] = null;
  let marketEvidence: ExportLineItem["marketEvidence"] = null;
  let marketRate: number | null = null;
  let costBuildupBreakdown: ExportLineItem["costBuildupBreakdown"] = null;

  if (isConfirmed && input.rateSource === "historical" && input.benchmarkSnapshot) {
    historicalBenchmarkRate = bestRate(input.benchmarkSnapshot.bestMatch);
    recommendedRate = historicalBenchmarkRate;
    confidence = benchmarkConfidenceToLevel(input.benchmarkSnapshot.confidence);
    pricingMethodKind = "historical";
    pricingMethodLabel = "Historical BOQ benchmark";
    benchmarkEvidence = input.benchmarkSnapshot;
  } else if (isConfirmed && input.rateSource === "build_up" && input.costBuildupComponents) {
    const result = calculateCostBuildup(input.costBuildupComponents, input.costBuildupMarkups ?? {});
    recommendedRate = result.suggestedRate;
    labourAllowance = input.costBuildupComponents.labourCost ?? null;
    plantAllowance = input.costBuildupComponents.plantCost ?? null;
    overheadsAmount = sumLinesWithPrefix(result.markupLines, OVERHEAD_LABEL_PREFIXES);
    profitAmount = sumLinesWithPrefix(result.markupLines, PROFIT_LABEL_PREFIXES);
    confidence = "medium";
    pricingMethodKind = "build_up";
    pricingMethodLabel = "Material + labour + plant + overhead + profit cost build-up";
    costBuildupBreakdown = result;
  } else if (isConfirmed && input.rateSource === "online" && input.marketResearchSnapshot) {
    const snapshot = input.marketResearchSnapshot;
    marketRate = snapshot.representativeBaseline ?? snapshot.acceptedEvidence[0]?.normalisedPrice ?? null;
    recommendedRate = marketRate;
    confidence = marketConfidenceToLevel(snapshot.overallConfidence);
    pricingMethodKind = "online";
    pricingMethodLabel = "Current market/material research";
    marketEvidence = snapshot;
  } else if (isConfirmed && input.rateSource === "online") {
    recommendedRate = input.estimatorRate;
    confidence = "low";
    pricingMethodKind = "online";
    pricingMethodLabel = "Online/material research (no evidence snapshot captured for this rate)";
  } else if (isConfirmed && input.rateSource === "manual") {
    confidence = "low";
    pricingMethodKind = "manual";
    pricingMethodLabel = "User/tender-provided rate";
  } else if (!isConfirmed && input.systemSuggestedSnapshot) {
    historicalBenchmarkRate = bestRate(input.systemSuggestedSnapshot.bestMatch);
    recommendedRate = historicalBenchmarkRate;
    confidence = benchmarkConfidenceToLevel(input.systemSuggestedSnapshot.confidence);
    benchmarkEvidence = input.systemSuggestedSnapshot;
    if (historicalBenchmarkRate !== null) {
      pricingMethodKind = "system_suggested";
      pricingMethodLabel = "System-suggested from historical benchmark — not yet confirmed by estimator";
    }
  }

  const finalRate = input.estimatorRate;
  const effectiveRateForAmount = finalRate ?? recommendedRate;
  const amount = effectiveRateForAmount !== null && input.quantity !== null ? effectiveRateForAmount * input.quantity : null;

  const flags: string[] = [];
  if (!isConfirmed) flags.push("Not yet reviewed by estimator");
  if (confidence === "review_required") flags.push("Insufficient evidence to safely recommend a rate");
  if (isConfirmed && input.rateSource === "manual") flags.push("No evidence trail captured for this rate");
  if (marketEvidence?.highVariance) flags.push("High market price variation across sources — supplier quotation recommended");

  return {
    id: input.id,
    itemCode: input.itemCode,
    description: input.description,
    unit: input.unit,
    quantity: input.quantity,
    originalRate: input.originalRate,
    historicalBenchmarkRate,
    marketRate,
    labourAllowance,
    plantAllowance,
    overheadsAmount,
    profitAmount,
    recommendedRate,
    finalRate,
    amount,
    isConfirmed,
    pricingMethodKind,
    pricingMethodLabel,
    confidence,
    notes: input.rateNotes,
    flags,
    categoryDivision: input.categoryDivision ?? "Uncategorised",
    constructionCategory: input.constructionCategory ?? "Uncategorised",
    benchmarkEvidence,
    marketEvidence,
    costBuildupBreakdown,
  };
}
