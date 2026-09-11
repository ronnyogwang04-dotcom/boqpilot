import { detectSourceOrigin } from "./source-origin";
import type { MarketEvidenceItem, NormalisedMarketEvidence, SourceEvidenceQuality } from "./types";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Pricing bases that are already a fixed rate per unit — no arithmetic needed, just a canonical unit label (spec §10). */
const DIRECT_PASSTHROUGH_UNIT: Partial<Record<MarketEvidenceItem["pricingBasis"], string>> = {
  each: "No",
  metre: "m",
  kg: "kg",
  tonne: "t",
  litre: "l",
  m2: "m²",
  m3: "m³",
  day: "day",
  hour: "hr",
};

/**
 * "length" and "pack"/"box" are the only bases that require dividing by a
 * stated quantity (6m pipe length, box of 100 fixings) — every other basis
 * is already a per-unit rate and is passed through unchanged. Never guesses
 * a pack/length quantity that wasn't stated (spec §10, §32): returns null
 * with an explanation instead. A source with no published price at all
 * (sourcePrice === null — PRICE_NOT_PUBLISHED, never a fabricated 0) can
 * never be normalised into a usable number, full stop.
 */
function normalisePriceAndUnit(item: Pick<MarketEvidenceItem, "pricingBasis" | "sourcePrice" | "packQuantity" | "currency">): {
  normalisedPrice: number | null;
  normalisedUnit: string | null;
  calculation: string | null;
} {
  const { pricingBasis, sourcePrice, packQuantity } = item;

  if (sourcePrice === null) {
    return { normalisedPrice: null, normalisedUnit: null, calculation: "Price not published — supplier quotation required." };
  }

  if (pricingBasis === "length" || pricingBasis === "pack" || pricingBasis === "box") {
    if (!packQuantity || packQuantity <= 0) {
      return { normalisedPrice: null, normalisedUnit: null, calculation: `Cannot normalise: ${pricingBasis} price with no pack/length quantity stated.` };
    }
    const unit = pricingBasis === "length" ? "m" : "No";
    const normalisedPrice = sourcePrice / packQuantity;
    const qtyLabel = pricingBasis === "length" ? `${packQuantity}m length` : `pack of ${packQuantity}`;
    return {
      normalisedPrice,
      normalisedUnit: unit,
      calculation: `${item.currency} ${sourcePrice.toFixed(2)} / ${qtyLabel} = ${item.currency} ${normalisedPrice.toFixed(2)}/${unit}`,
    };
  }

  const unit = DIRECT_PASSTHROUGH_UNIT[pricingBasis] ?? null;
  if (!unit) {
    return { normalisedPrice: null, normalisedUnit: null, calculation: "Cannot normalise: pricing basis not recognised as a fixed unit rate." };
  }
  return { normalisedPrice: sourcePrice, normalisedUnit: unit, calculation: null };
}

/**
 * Turns one raw provider evidence item into persistable evidence: computes
 * the unit-normalised price, resolves the source domain and country origin,
 * and marks whether the cited URL (or at least its domain) actually appears
 * among the web search tool's own grounding citations. A structured-output
 * field the model asserts but the tool never cited is downgraded to
 * "unverified" rather than silently trusted or silently dropped — the
 * estimator can still see it and judge it (spec §7, §23: never trust
 * unvalidated free-text AI output as pricing evidence).
 *
 * VAT status is carried through untouched — this function never converts
 * between inclusive/exclusive, since that requires assuming a VAT rate the
 * source didn't necessarily confirm (spec §9: do not silently assume, do
 * not apply VAT twice).
 */
export function normaliseEvidence(item: MarketEvidenceItem, citedUrls: Set<string>): NormalisedMarketEvidence {
  const { normalisedPrice, normalisedUnit, calculation } = normalisePriceAndUnit(item);
  const sourceDomain = extractDomain(item.sourceUrl);
  const citedDomains = new Set(Array.from(citedUrls).map(extractDomain));
  const verified = citedUrls.has(item.sourceUrl) || citedDomains.has(sourceDomain);
  const sourceOrigin = detectSourceOrigin({
    sourceDomain,
    geographicRelevance: item.geographicRelevance,
    productDescription: item.productDescription,
    notes: item.notes,
  });

  let evidenceQuality: SourceEvidenceQuality;
  if (!verified) {
    evidenceQuality = "unverified";
  } else if (item.matchType === "exact" && normalisedPrice !== null) {
    evidenceQuality = "strong";
  } else if (normalisedPrice !== null) {
    evidenceQuality = "reasonable";
  } else {
    evidenceQuality = "limited";
  }

  return {
    ...item,
    sourceDomain,
    sourceOrigin,
    normalisedUnit,
    normalisedPrice,
    normalisationCalculation: calculation,
    evidenceQuality,
    verified,
  };
}
