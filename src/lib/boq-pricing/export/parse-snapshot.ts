import type { Json } from "@/types/database.types";
import type { CostBuildupComponents, CostBuildupMarkups } from "../cost-buildup";
import type { MarketEvidenceClassification, MarketEvidenceQuality, MarketResearchSnapshotEvidence, MarketResearchStatus, MatchType, PricingBasis, SourceEvidenceQuality, SourceOrigin, VatStatus } from "../market-research/types";
import type { StoredBenchmarkSnapshot, StoredMarketResearchSnapshot } from "./types";

/**
 * Defensive parsing for the jsonb snapshot columns — round-tripping through
 * Postgres jsonb means these arrive back as `Json` (effectively `unknown`),
 * not the typed shape they were written as. Every field falls back to null
 * on anything unexpected rather than throwing, so a malformed or
 * legacy-shaped snapshot degrades to "no evidence recorded" instead of
 * crashing the export.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseCostBuildupComponents(json: Json | null): CostBuildupComponents | null {
  if (!isRecord(json)) return null;
  return {
    materialCost: numberOrNull(json.materialCost),
    wastagePercent: numberOrNull(json.wastagePercent),
    labourCost: numberOrNull(json.labourCost),
    plantCost: numberOrNull(json.plantCost),
    consumablesCost: numberOrNull(json.consumablesCost),
    transportCost: numberOrNull(json.transportCost),
    subcontractorCost: numberOrNull(json.subcontractorCost),
    otherDirectCost: numberOrNull(json.otherDirectCost),
  };
}

export function parseCostBuildupMarkups(json: Json | null): CostBuildupMarkups | null {
  if (!isRecord(json)) return null;
  return {
    siteOverheadPercent: numberOrNull(json.siteOverheadPercent),
    headOfficeOverheadPercent: numberOrNull(json.headOfficeOverheadPercent),
    contingencyPercent: numberOrNull(json.contingencyPercent),
    profitPercent: numberOrNull(json.profitPercent),
  };
}

const VALID_CONFIDENCE = new Set(["strong", "reasonable", "weak", "none"]);

function parseMatch(json: unknown): StoredBenchmarkSnapshot["bestMatch"] {
  if (!isRecord(json)) return null;
  const id = json.id;
  if (typeof id !== "string") return null;
  return {
    id,
    description: stringOrNull(json.description),
    unit: stringOrNull(json.unit),
    division: stringOrNull(json.division),
    category: stringOrNull(json.category),
    similarity: typeof json.similarity === "number" ? json.similarity : 0,
    score: typeof json.score === "number" ? json.score : 0,
    sampleCount: typeof json.sampleCount === "number" ? json.sampleCount : 0,
    projectCount: typeof json.projectCount === "number" ? json.projectCount : 0,
    avgRate: numberOrNull(json.avgRate),
    medianRate: numberOrNull(json.medianRate),
    minRate: numberOrNull(json.minRate),
    maxRate: numberOrNull(json.maxRate),
    stddevRate: numberOrNull(json.stddevRate),
    mostRecentRate: numberOrNull(json.mostRecentRate),
    mostRecentRateAt: stringOrNull(json.mostRecentRateAt),
  };
}

export function parseBenchmarkSnapshot(json: Json | null): StoredBenchmarkSnapshot | null {
  if (!isRecord(json)) return null;
  const confidence =
    typeof json.confidence === "string" && VALID_CONFIDENCE.has(json.confidence)
      ? (json.confidence as StoredBenchmarkSnapshot["confidence"])
      : null;
  if (!confidence) return null;

  const evidence = Array.isArray(json.evidence)
    ? json.evidence.map(parseMatch).filter((match): match is NonNullable<typeof match> => match !== null)
    : [];

  return {
    confidence,
    bestMatch: parseMatch(json.bestMatch),
    evidence,
    inferredCategory: stringOrNull(json.inferredCategory),
    inferredUnit: stringOrNull(json.inferredUnit),
  };
}

const VALID_MARKET_STATUS = new Set(["pending", "researching", "complete", "no_result", "needs_review", "failed"]);
const VALID_MARKET_QUALITY = new Set(["strong", "reasonable", "limited", "none"]);
const VALID_VAT_STATUS = new Set(["inclusive", "exclusive", "unknown"]);
const VALID_EVIDENCE_QUALITY = new Set(["strong", "reasonable", "limited", "unverified"]);
const VALID_MATCH_TYPE = new Set(["exact", "comparable", "unknown"]);
const VALID_PRICING_BASIS = new Set(["each", "metre", "length", "pack", "box", "kg", "tonne", "litre", "m2", "m3", "day", "hour", "other"]);
const VALID_EVIDENCE_CLASSIFICATION = new Set([
  "material_product_price",
  "supply_only_price",
  "supply_and_install_price",
  "installed_service_rate",
  "equipment_hire_rate",
  "subcontractor_specialist_price",
  "other",
  "unknown",
]);
const VALID_SOURCE_ORIGIN = new Set(["south_africa", "international", "unknown"]);

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** A malformed evidence row is dropped rather than defaulting fields to fabricated values — an item this export can't confidently parse simply doesn't appear as evidence (never invented, per spec §32). */
function parseSnapshotEvidenceItem(json: unknown): MarketResearchSnapshotEvidence | null {
  if (!isRecord(json)) return null;
  const id = stringOrNull(json.id);
  const supplierName = stringOrNull(json.supplierName);
  const sourcePrice = numberOrNull(json.sourcePrice);
  const vatStatus = typeof json.vatStatus === "string" && VALID_VAT_STATUS.has(json.vatStatus) ? (json.vatStatus as VatStatus) : null;
  const pricingBasis = typeof json.pricingBasis === "string" && VALID_PRICING_BASIS.has(json.pricingBasis) ? (json.pricingBasis as PricingBasis) : null;
  const evidenceClassification =
    typeof json.evidenceClassification === "string" && VALID_EVIDENCE_CLASSIFICATION.has(json.evidenceClassification)
      ? (json.evidenceClassification as MarketEvidenceClassification)
      : null;
  const matchType = typeof json.matchType === "string" && VALID_MATCH_TYPE.has(json.matchType) ? (json.matchType as MatchType) : null;
  const evidenceQuality = typeof json.evidenceQuality === "string" && VALID_EVIDENCE_QUALITY.has(json.evidenceQuality) ? (json.evidenceQuality as SourceEvidenceQuality) : null;
  const sourceOrigin: SourceOrigin = typeof json.sourceOrigin === "string" && VALID_SOURCE_ORIGIN.has(json.sourceOrigin) ? (json.sourceOrigin as SourceOrigin) : "unknown";
  const retrievedAt = stringOrNull(json.retrievedAt);

  // sourcePrice is deliberately NOT required here — null is the honest
  // PRICE_NOT_PUBLISHED state (spec: never reject/rewrite it as 0), so a
  // source with no listed price still round-trips through a saved snapshot.
  if (!id || !supplierName || !vatStatus || !pricingBasis || !evidenceClassification || !matchType || !evidenceQuality || !retrievedAt) {
    return null;
  }

  return {
    id,
    supplierName,
    sourceTitle: stringOrNull(json.sourceTitle),
    sourceUrl: stringOrNull(json.sourceUrl) ?? "",
    sourceDomain: stringOrNull(json.sourceDomain) ?? "",
    sourceOrigin,
    productDescription: stringOrNull(json.productDescription) ?? "",
    manufacturer: stringOrNull(json.manufacturer),
    brand: stringOrNull(json.brand),
    specification: stringOrNull(json.specification),
    dimensions: stringOrNull(json.dimensions),
    sourcePrice,
    currency: stringOrNull(json.currency) ?? "ZAR",
    vatStatus,
    pricingBasis,
    packQuantity: numberOrNull(json.packQuantity),
    deliveryStatus: stringOrNull(json.deliveryStatus),
    geographicRelevance: stringOrNull(json.geographicRelevance),
    evidenceClassification,
    matchType,
    sourceDate: stringOrNull(json.sourceDate),
    notes: stringOrNull(json.notes),
    normalisedUnit: stringOrNull(json.normalisedUnit),
    normalisedPrice: numberOrNull(json.normalisedPrice),
    normalisationCalculation: stringOrNull(json.normalisationCalculation),
    evidenceQuality,
    verified: booleanOr(json.verified, false),
    isManual: booleanOr(json.isManual, false),
    quoteReference: stringOrNull(json.quoteReference),
    retrievedAt,
  };
}

export function parseMarketResearchSnapshot(json: Json | null): StoredMarketResearchSnapshot | null {
  if (!isRecord(json)) return null;

  const overallConfidence = typeof json.overallConfidence === "string" && VALID_MARKET_QUALITY.has(json.overallConfidence) ? (json.overallConfidence as MarketEvidenceQuality) : null;
  if (!overallConfidence) return null;

  const runStatus = typeof json.runStatus === "string" && VALID_MARKET_STATUS.has(json.runStatus) ? (json.runStatus as MarketResearchStatus) : null;

  const observedRangeJson = json.observedRange;
  const observedRange = isRecord(observedRangeJson)
    ? (() => {
        const min = numberOrNull(observedRangeJson.min);
        const max = numberOrNull(observedRangeJson.max);
        const unit = stringOrNull(observedRangeJson.unit);
        const sourceCount = numberOrNull(observedRangeJson.sourceCount);
        return min !== null && max !== null && unit && sourceCount !== null ? { min, max, unit, sourceCount } : null;
      })()
    : null;

  const acceptedEvidence = Array.isArray(json.acceptedEvidence)
    ? json.acceptedEvidence.map(parseSnapshotEvidenceItem).filter((item): item is MarketResearchSnapshotEvidence => item !== null)
    : [];

  return {
    runStatus,
    overallConfidence,
    observedRange,
    representativeBaseline: numberOrNull(json.representativeBaseline),
    highVariance: booleanOr(json.highVariance, false),
    comparabilityNote: stringOrNull(json.comparabilityNote),
    researchedAt: stringOrNull(json.researchedAt),
    acceptedEvidence,
  };
}
