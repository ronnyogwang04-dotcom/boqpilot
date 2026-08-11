// Deterministic unit normalisation — collapses common BOQ unit spellings
// down to one canonical token per real-world unit of measure. Version-
// controlled for now; structured as a flat map so a future move to a
// database-backed dictionary is a data migration, not a rewrite.
const UNIT_SYNONYMS: Record<string, string> = {
  m2: "m²",
  sqm: "m²",
  "sq.m": "m²",
  "sq m": "m²",
  "square metre": "m²",
  "square meter": "m²",
  "square metres": "m²",

  m3: "m³",
  cum: "m³",
  "cu.m": "m³",
  "cu m": "m³",
  "cubic metre": "m³",
  "cubic meter": "m³",
  "cubic metres": "m³",

  no: "No",
  "no.": "No",
  nr: "No",
  "nr.": "No",
  ea: "No",
  each: "No",
  unit: "No",
  units: "No",

  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",

  t: "t",
  ton: "t",
  tons: "t",
  tonne: "t",
  tonnes: "t",

  m: "m",
  lm: "m",
  "l.m": "m",
  "l/m": "m",
  "linear metre": "m",
  "linear meter": "m",
  metre: "m",
  meter: "m",
  metres: "m",

  l: "l",
  litre: "l",
  liter: "l",
  litres: "l",

  sum: "sum",
  item: "sum",
  ls: "sum",
  "lump sum": "sum",
  lumpsum: "sum",

  hr: "hr",
  hrs: "hr",
  hour: "hr",
  hours: "hr",

  day: "day",
  days: "day",

  "%": "%",
  percent: "%",

  set: "Sets",
  sets: "Sets",

  pair: "Pairs",
  pairs: "Pairs",
};

/** Canonicalises a unit string; falls back to the trimmed original for anything not in the synonym map. */
export function normaliseUnit(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (key === "") return null;
  return UNIT_SYNONYMS[key] ?? raw.trim();
}

// The full set of canonical unit tokens normaliseUnit() can ever produce
// from a recognised spelling. Anything outside this set on a canonical item
// fell through the fallback above — i.e. its unit wasn't recognised at all
// — which is the admin UI's signal to flag it for review.
export const CANONICAL_UNITS = new Set(Object.values(UNIT_SYNONYMS));

export function isKnownUnit(normalised: string | null): boolean {
  return normalised !== null && CANONICAL_UNITS.has(normalised);
}
