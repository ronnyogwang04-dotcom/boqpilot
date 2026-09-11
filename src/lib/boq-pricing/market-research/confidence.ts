import { marketResearchConfig } from "@/config/market-research";
import { buildSpecSignature, UNSPECIFIED_SIGNATURE } from "./spec-signature";
import type { MarketEvidenceQuality, NormalisedMarketEvidence, ObservedRange } from "./types";

export const INSUFFICIENT_COMPARABILITY_NOTE =
  "Multiple market prices were found, but the products/equipment differ in specification and could not be confirmed as technically comparable. Supplier quotation/manual review recommended.";

/**
 * Only verified, priced, comparable evidence ever counts towards confidence
 * or aggregation — unverified sources (see normalise-evidence.ts) and
 * sources with no published price (PRICE_NOT_PUBLISHED, normalisedPrice
 * null) are excluded rather than silently trusted (spec §17, §32). A
 * source quoted in a currency other than the configured market currency
 * (ZAR) is never silently converted (no FX rate is assumed) — it's shown to
 * the estimator but excluded from confidence/aggregation, same treatment as
 * an unnormalisable price.
 */
function usableEvidence(evidence: NormalisedMarketEvidence[]): NormalisedMarketEvidence[] {
  return evidence.filter((e) => e.verified && e.normalisedPrice !== null && e.currency === marketResearchConfig.currency);
}

/**
 * South Africa is the default comparable market (spec: "South African
 * sources should be the default comparable set"). Confirmed-foreign
 * ("international") sources are set aside and only pulled back in as a
 * fallback when there is literally no South-African-or-unknown-origin
 * evidence to work with — never blended in by default alongside SA
 * evidence.
 */
function southAfricanFirst(evidence: NormalisedMarketEvidence[]): { primary: NormalisedMarketEvidence[]; usedInternationalFallback: boolean } {
  const domestic = evidence.filter((e) => e.sourceOrigin !== "international");
  if (domestic.length > 0) return { primary: domestic, usedInternationalFallback: false };
  return { primary: evidence, usedInternationalFallback: evidence.length > 0 };
}

type SpecGroup = { signature: string; items: NormalisedMarketEvidence[] };

function groupBySpecification(items: NormalisedMarketEvidence[], brandSpecific: string | null): Map<string, SpecGroup> {
  const groups = new Map<string, SpecGroup>();
  for (const item of items) {
    const signature = buildSpecSignature(item, brandSpecific);
    const key = `${item.normalisedUnit}::${item.evidenceClassification}::${signature}`;
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { signature, items: [item] });
  }
  return groups;
}

function normaliseForComparison(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fail-closed comparability rule: a group with a *recognised* structured
 * attribute (diameter, power, flow, pressure, head, volume, grade, ...) is
 * trusted — the shared signature is itself the evidence of comparability.
 * A group that fell into the catch-all "unspecified" bucket (no attribute
 * spec-signature.ts recognised) is trusted ONLY when every item's own
 * description text is effectively identical — i.e. the same product listed
 * by different suppliers, not merely several un-parsed but materially
 * different variants (the Gravitron dewatering-pump-hire case: a mist rig,
 * a fire pump, and a filtration pump all landed in "unspecified" and must
 * NOT be averaged just because none of their distinguishing attributes —
 * flow rate, hose diameter — were recognised).
 */
function isTrustworthyGroup(group: SpecGroup): boolean {
  if (group.signature !== UNSPECIFIED_SIGNATURE) return true;
  if (group.items.length <= 1) return true;
  const distinctDescriptions = new Set(group.items.map((e) => normaliseForComparison(`${e.productDescription} ${e.specification ?? ""} ${e.dimensions ?? ""}`)));
  return distinctDescriptions.size === 1;
}

function largestTrustworthyGroupSize(items: NormalisedMarketEvidence[], brandSpecific: string | null): number {
  const groups = groupBySpecification(items, brandSpecific);
  let max = 0;
  for (const group of groups.values()) {
    if (isTrustworthyGroup(group)) max = Math.max(max, group.items.length);
  }
  return max;
}

/**
 * Explicit, defensible formula (spec §17 — no arbitrary confidence %):
 * - none: no usable evidence at all.
 * - strong: the largest same-specification group of *exact*-match sources
 *   reaches strongEvidenceMinSources, and VAT status is known for every
 *   usable (primary, SA-first) source — no ambiguity left in the numbers
 *   shown. Two exact matches for *different* specifications (e.g. a 10mm
 *   and a 16mm reinforcing bar) no longer count as two corroborating
 *   sources for the same product.
 * - reasonable: at least one exact-match usable source exists, even if it
 *   stands alone or its group didn't reach the "strong" threshold.
 * - limited: usable evidence exists but doesn't clear either bar above
 *   (e.g. only comparable/substitute sources, or VAT status unknown).
 */
export function computeMarketEvidenceQuality(evidence: NormalisedMarketEvidence[], brandSpecific: string | null = null): MarketEvidenceQuality {
  const usable = usableEvidence(evidence);
  if (usable.length === 0) return "none";

  const { primary } = southAfricanFirst(usable);
  const exact = primary.filter((e) => e.matchType === "exact");
  const vatKnownCount = primary.filter((e) => e.vatStatus !== "unknown").length;

  if (exact.length === 0) return "limited";

  const largestExactGroup = largestTrustworthyGroupSize(exact, brandSpecific);
  if (largestExactGroup >= marketResearchConfig.strongEvidenceMinSources && vatKnownCount === primary.length) {
    return "strong";
  }
  return "reasonable";
}

export type EvidenceAggregation = {
  observedRange: ObservedRange | null;
  representativeBaseline: number | null;
  highVariance: boolean;
  /** Set whenever the baseline/range could not be (fully) computed and why — never silently blended into a number regardless. */
  comparabilityNote: string | null;
  usedInternationalFallback: boolean;
};

/**
 * Groups usable, *exact-match* evidence by (unit, evidence classification,
 * spec-signature) — a reinforcing bar's diameter, a pump's power rating, a
 * geyser's capacity, etc. are all part of the signature (spec-signature.ts),
 * so a 10mm bar is never averaged with a 16mm bar just because both are
 * "reinforcement, priced per each" (spec §... comparability requirement).
 * Only the single largest such group is aggregated into a range/baseline;
 * everything else is left as individual evidence for the estimator to
 * weigh. Comparable/substitute sources (matchType !== "exact") are never
 * folded into this baseline at all — they remain visible as evidence, just
 * labelled as substitutes, never silently influencing the exact-product
 * number. When there isn't enough *comparable* exact evidence to form a
 * baseline, this says so explicitly rather than forcing an average.
 */
export function aggregateMarketEvidence(evidence: NormalisedMarketEvidence[], brandSpecific: string | null = null): EvidenceAggregation {
  const usable = usableEvidence(evidence).filter((e) => e.normalisedUnit !== null);
  const { primary, usedInternationalFallback } = southAfricanFirst(usable);

  const exact = primary.filter((e) => e.matchType === "exact");
  const comparableCount = primary.filter((e) => e.matchType === "comparable").length;

  if (exact.length === 0) {
    return {
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote:
        comparableCount > 0
          ? `Insufficient exact/equivalent sources for a market baseline — ${comparableCount} comparable substitute(s) available for reference only.`
          : null,
      usedInternationalFallback,
    };
  }

  const groups = groupBySpecification(exact, brandSpecific);
  let largestGroup: SpecGroup | null = null;
  for (const group of groups.values()) {
    if (!largestGroup || group.items.length > largestGroup.items.length) largestGroup = group;
  }
  // exact.length > 0 guarantees at least one group.
  const winner = largestGroup as SpecGroup;

  if (winner.items.length < marketResearchConfig.minSourcesForAggregation) {
    if (exact.length === 1) {
      return { observedRange: null, representativeBaseline: exact[0].normalisedPrice, highVariance: false, comparabilityNote: null, usedInternationalFallback };
    }
    return {
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: `${exact.length} exact-match sources found but for different specifications (e.g. different diameters/capacities/grades) — not enough comparable sources for any single specification to form a market baseline.`,
      usedInternationalFallback,
    };
  }

  // Fail closed: a group that only shares the catch-all "unspecified"
  // bucket — no recognised attribute ties these sources together, and
  // their own descriptions genuinely differ — is never averaged just
  // because it happens to be the largest group by count.
  if (!isTrustworthyGroup(winner)) {
    return {
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: INSUFFICIENT_COMPARABILITY_NOTE,
      usedInternationalFallback,
    };
  }

  const prices = winner.items.map((e) => e.normalisedPrice as number).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
  const stddev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stddev / mean : 0;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;

  return {
    observedRange: { min, max, unit: winner.items[0].normalisedUnit as string, sourceCount: winner.items.length },
    representativeBaseline: median,
    highVariance: coefficientOfVariation >= marketResearchConfig.highVarianceCoefficient,
    comparabilityNote: null,
    usedInternationalFallback,
  };
}
