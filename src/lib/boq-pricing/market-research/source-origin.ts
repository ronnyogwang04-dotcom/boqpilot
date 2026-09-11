import type { SourceOrigin } from "./types";

export const INTERNATIONAL_REFERENCE_LABEL = "International reference — not directly comparable to South African market pricing.";

/** .za and its common second-level variants — a strong, general TLD signal, not a list of specific suppliers. */
const SA_DOMAIN_PATTERN = /\.(co\.za|org\.za|net\.za|gov\.za|ac\.za|web\.za|za)$/i;

/**
 * A trailing two-letter country-code TLD that isn't "za" (e.g. .com.au,
 * .co.uk, .co.nz, .com.mv) is a reasonable general signal of a foreign
 * site. A bare ".com"/".net"/".org" has no such suffix and is deliberately
 * left ambiguous (unknown) rather than assumed foreign — plenty of
 * legitimate South African merchants trade under .com.
 */
const FOREIGN_CCTLD_PATTERN = /\.([a-z]{2})$/i;

function hasForeignCountryCodeTld(domain: string): boolean {
  const match = domain.match(FOREIGN_CCTLD_PATTERN);
  if (!match) return false;
  return match[1].toLowerCase() !== "za";
}

// A short list of country *names* (not supplier names) that occasionally
// show up in source titles/descriptions/geographic-relevance text — a
// general content signal, not a brittle enumeration of every possible South
// African supplier (which is explicitly what this must avoid).
const FOREIGN_COUNTRY_HINTS = [
  "australia",
  "united kingdom",
  "u.k.",
  "usa",
  "u.s.a",
  "united states",
  "canada",
  "new zealand",
  "india",
  "nigeria",
  "kenya",
  "germany",
  "china",
  "maldives",
];

const SOUTH_AFRICAN_LOCATION_HINTS = [
  "south africa",
  "gauteng",
  "western cape",
  "eastern cape",
  "kwazulu",
  "free state",
  "limpopo",
  "mpumalanga",
  "north west",
  "northern cape",
];

function mentionsAny(text: string | null, hints: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

/**
 * Deterministic, content-based origin detection (spec: "detect source
 * country where reasonably possible from domain/content/source metadata").
 * Never a hard-coded list of South African suppliers — only a general TLD
 * rule plus a short list of country *names*. A generic ".com" domain with no
 * other signal is "unknown", not automatically foreign; a ".co.za" domain
 * is a strong geography signal but says nothing about the source's
 * credibility (that's evidenceQuality's job, not this function's).
 */
export function detectSourceOrigin(input: {
  sourceDomain: string;
  geographicRelevance: string | null;
  productDescription: string | null;
  notes: string | null;
}): SourceOrigin {
  if (SA_DOMAIN_PATTERN.test(input.sourceDomain)) return "south_africa";
  if (hasForeignCountryCodeTld(input.sourceDomain)) return "international";

  if (mentionsAny(input.geographicRelevance, FOREIGN_COUNTRY_HINTS) || mentionsAny(input.notes, FOREIGN_COUNTRY_HINTS) || mentionsAny(input.productDescription, FOREIGN_COUNTRY_HINTS)) {
    return "international";
  }
  if (mentionsAny(input.geographicRelevance, SOUTH_AFRICAN_LOCATION_HINTS)) {
    return "south_africa";
  }

  return "unknown";
}
