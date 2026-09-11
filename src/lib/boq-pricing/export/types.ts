import type { HistoricalBenchmarkResult } from "../benchmark";
import type { CostBuildupComponents, CostBuildupMarkups, CostBuildupResult } from "../cost-buildup";
import type { MarketResearchSnapshot } from "../market-research/types";
import type { BoqLineItemRateSource } from "@/types/database.types";

/** Both the estimator's saved evidence and the export's cached suggestion round-trip through jsonb as this exact shape. */
export type StoredBenchmarkSnapshot = HistoricalBenchmarkResult;

/** The saved market-research snapshot round-trips through jsonb as this exact shape (see market-research/types.ts). */
export type StoredMarketResearchSnapshot = MarketResearchSnapshot;

/**
 * How confident BOQPilot is that a rate is right — deliberately broader than
 * BenchmarkConfidence (which only grades historical-match quality): every
 * pricing method maps into this same four-level scale so the Estimator
 * Report can summarise across historical, build-up, and manual rates
 * uniformly. "review_required" always means "do not treat this number as
 * safe to tender" — see spec §11: never hide uncertainty.
 */
export type PricingConfidenceLevel = "high" | "medium" | "low" | "review_required";

export const CONFIDENCE_LEVEL_LABELS: Record<PricingConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review_required: "Review Required",
};

export type PricingMethodKind = "historical" | "build_up" | "online" | "manual" | "system_suggested" | "insufficient_data";

/** One boq_line_items rate-item row as the export pipeline needs it — jsonb snapshot columns already parsed. */
export type ExportLineItemInput = {
  id: string;
  itemCode: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  originalRate: number | null;
  categoryDivision: string | null;
  constructionCategory: string | null;
  estimatorRate: number | null;
  rateSource: BoqLineItemRateSource | null;
  rateNotes: string | null;
  costBuildupComponents: CostBuildupComponents | null;
  costBuildupMarkups: CostBuildupMarkups | null;
  benchmarkSnapshot: StoredBenchmarkSnapshot | null;
  systemSuggestedSnapshot: StoredBenchmarkSnapshot | null;
  marketResearchSnapshot: StoredMarketResearchSnapshot | null;
};

/** Fully resolved row, ready for every export sheet — every field is either a persisted value, a deterministic recomputation of persisted inputs, or null. Never fabricated. */
export type ExportLineItem = {
  id: string;
  itemCode: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  originalRate: number | null;
  historicalBenchmarkRate: number | null;
  marketRate: number | null;
  labourAllowance: number | null;
  plantAllowance: number | null;
  overheadsAmount: number | null;
  profitAmount: number | null;
  recommendedRate: number | null;
  finalRate: number | null;
  amount: number | null;
  /** Whether the estimator has explicitly saved a decision for this row (vs. a system-computed suggestion). */
  isConfirmed: boolean;
  pricingMethodKind: PricingMethodKind;
  pricingMethodLabel: string;
  confidence: PricingConfidenceLevel;
  notes: string | null;
  flags: string[];
  categoryDivision: string;
  constructionCategory: string;
  /** Whichever benchmark snapshot backs this row's recommended/historical rate (saved decision or cached suggestion), for the Sources sheet. */
  benchmarkEvidence: StoredBenchmarkSnapshot | null;
  /** The saved market-research snapshot backing a rate_source = 'online' row, for the Sources sheet. Null for every other pricing method. */
  marketEvidence: StoredMarketResearchSnapshot | null;
  /** Full calculateCostBuildup() output for a confirmed build_up row, for the Pricing Analysis sheet — null for every other pricing method. */
  costBuildupBreakdown: CostBuildupResult | null;
};

export type WorkGroupSummary = {
  division: string;
  itemCount: number;
  totalAmount: number;
  pricedItemCount: number;
  reviewRequiredCount: number;
};

export type KeyItemFlagReason =
  | "price_magnitude"
  | "limited_evidence"
  | "market_volatility"
  | "specification_uncertainty"
  | "brand_dependence"
  | "quantity"
  | "provisional_sum";

export type KeyItemFlag = {
  itemId: string;
  itemCode: string | null;
  description: string;
  amount: number | null;
  reasonCategory: KeyItemFlagReason;
  what: string;
  why: string;
  recommendedAction: string;
};

export type PricingNote = {
  category: string;
  detail: string;
};

export type EstimatorReportSummary = {
  projectName: string;
  boqName: string;
  dateProcessed: string;
  totalItems: number;
  pricedItems: number;
  reviewRequiredItems: number;
  totalBoqValue: number;
  historicalBenchmarkedCount: number;
  historicalBenchmarkedValue: number;
  marketResearchedCount: number;
  marketResearchedValue: number;
  reviewRequiredValue: number;
  confidenceBreakdown: Record<PricingConfidenceLevel, { count: number; value: number }>;
};

export type MarkupDefaults = {
  wastagePercent: number;
  siteOverheadPercent: number;
  headOfficeOverheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
};

export type ExportWorkbookData = {
  projectName: string;
  boqName: string;
  report: EstimatorReportSummary;
  lineItems: ExportLineItem[];
  workGroups: WorkGroupSummary[];
  keyItemFlags: KeyItemFlag[];
  pricingNotes: PricingNote[];
  markupDefaults: MarkupDefaults;
};
