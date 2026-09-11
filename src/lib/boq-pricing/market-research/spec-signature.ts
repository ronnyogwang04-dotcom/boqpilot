// Comparability fingerprinting: before multiple evidence rows are ever
// averaged into a market baseline, they must be grouped by more than just
// (unit + evidence classification) — otherwise a 10mm reinforcing bar and a
// 16mm reinforcing bar (or a 0.75kW pump and a 2.2kW pump) end up blended
// into one meaningless "average", which is exactly the bug the live
// validation surfaced. This module extracts a handful of common, structured
// measurable attributes (diameter/connection size, power rating, flow rate,
// pressure/head, volume, grade) from each evidence item's own free-text
// fields so genuinely different products land in different comparability
// groups. This list is deliberately NOT exhaustive — it covers the obvious,
// deterministically-recognisable attributes only. confidence.ts's
// fail-closed rule is the actual safety net for whatever this module
// doesn't recognise: items with no detected attribute are only aggregated
// when their own descriptions are effectively identical, never merely
// because they share the "unspecified" bucket.

function extractDiameterMm(text: string): number | null {
  // South African rebar codes ("Y10", "Y12", "Y16") state diameter without
  // "mm" — checked first since it's the more specific pattern. Falls back to
  // a plain "Nmm" reading (e.g. "110mm diameter", "10MM X 6M") so a source
  // phrased either way lands in the same group.
  const rebar = text.match(/\by(\d{1,2})\b/i);
  if (rebar) return Number(rebar[1]);
  const mm = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*mm\b/i);
  return mm ? Number(mm[1]) : null;
}

function extractPowerKw(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*kw\b/i);
  return match ? Number(match[1]) : null;
}

function extractPowerKva(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*kva\b/i);
  return match ? Number(match[1]) : null;
}

/** Excludes a flow-rate reading like "3litres/second" — the negative lookahead skips a volume unit immediately followed by "/", which is a rate, not a capacity. Allows an optional hyphen between the number and unit ("120-litre"). */
function extractVolumeLitre(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)[\s-]*(?:litres?|liters?|l)\b(?!\s*\/)/i);
  return match ? Number(match[1]) : null;
}

function extractGradeMpa(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*mpa\b/i);
  return match ? Number(match[1]) : null;
}

/** L/min-family flow rate — "100 L/min", "100lpm", "100 litres/minute". Deliberately not merged with m³/h (extractFlowM3h) — different units, never silently converted. */
function extractFlowLpm(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:l\/min|lpm|litres?\/min(?:ute)?|liters?\/min(?:ute)?)\b/i);
  return match ? Number(match[1]) : null;
}

function extractFlowM3h(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*m(?:3|³)\s*\/\s*h\b/i);
  return match ? Number(match[1]) : null;
}

/** Diameter/connection size in inches — "2 inch", "2-inch", or the bare quote mark ("2" Firehose"), which is how real supplier listings phrase hose/pipe connection sizes. */
function extractDiameterInches(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:"|inch(?:es)?\b)/i);
  return match ? Number(match[1]) : null;
}

function extractPressureBar(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*bar\b/i);
  return match ? Number(match[1]) : null;
}

function extractPressureKpa(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*kpa\b/i);
  return match ? Number(match[1]) : null;
}

/** Pumping head — "30m head", "30 metres head", "30m pumping head", explicitly tied to the word "head" so a plain length/dimension elsewhere in the text is never mistaken for it. */
function extractHeadMetres(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\s*(?:pumping\s+)?head\b/i);
  return match ? Number(match[1]) : null;
}

export const UNSPECIFIED_SIGNATURE = "unspecified";

export type SpecSignatureInput = {
  dimensions: string | null;
  specification: string | null;
  productDescription: string;
  brand: string | null;
};

/**
 * Builds a comparability key from whichever measurable attributes are
 * actually present. Two sources with no detectable attribute at all fall
 * back to a shared "unspecified" bucket (still separated by unit +
 * classification upstream) rather than each getting their own group of one
 * — a deliberate middle ground, not a claim that they're proven identical.
 *
 * `brandSpecific` should be the *original BOQ item's* specified brand (from
 * MarketSearchSpecification.brand), not the evidence's own brand — it's
 * only folded into the key when the BOQ itself named a brand, so a
 * brand-specified item's exact matches aren't accidentally merged across
 * different brands, while a generic (non-brand-specified) item isn't
 * needlessly fragmented by whatever brand each supplier happens to stock.
 */
export function buildSpecSignature(evidence: SpecSignatureInput, brandSpecific: string | null = null): string {
  const haystack = [evidence.dimensions, evidence.specification, evidence.productDescription].filter(Boolean).join(" ");

  const parts: string[] = [];
  const diameter = extractDiameterMm(haystack);
  if (diameter !== null) parts.push(`dia${diameter}mm`);
  const kw = extractPowerKw(haystack);
  if (kw !== null) parts.push(`${kw}kw`);
  const kva = extractPowerKva(haystack);
  if (kva !== null) parts.push(`${kva}kva`);
  const litre = extractVolumeLitre(haystack);
  if (litre !== null) parts.push(`${litre}l`);
  const mpa = extractGradeMpa(haystack);
  if (mpa !== null) parts.push(`${mpa}mpa`);
  const lpm = extractFlowLpm(haystack);
  if (lpm !== null) parts.push(`${lpm}lpm`);
  const m3h = extractFlowM3h(haystack);
  if (m3h !== null) parts.push(`${m3h}m3h`);
  const inches = extractDiameterInches(haystack);
  if (inches !== null) parts.push(`${inches}in`);
  const bar = extractPressureBar(haystack);
  if (bar !== null) parts.push(`${bar}bar`);
  const kpa = extractPressureKpa(haystack);
  if (kpa !== null) parts.push(`${kpa}kpa`);
  const head = extractHeadMetres(haystack);
  if (head !== null) parts.push(`${head}mhead`);

  if (brandSpecific && evidence.brand) {
    parts.push(`brand:${evidence.brand.trim().toLowerCase()}`);
  }

  return parts.length > 0 ? parts.sort().join("|") : UNSPECIFIED_SIGNATURE;
}

export const __testables = {
  extractDiameterMm,
  extractPowerKw,
  extractPowerKva,
  extractVolumeLitre,
  extractGradeMpa,
  extractFlowLpm,
  extractFlowM3h,
  extractDiameterInches,
  extractPressureBar,
  extractPressureKpa,
  extractHeadMetres,
};
