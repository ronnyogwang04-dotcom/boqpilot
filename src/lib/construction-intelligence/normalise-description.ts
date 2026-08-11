// Deterministic description normalisation — no AI. This is the canonical,
// human-readable text stored on rate_library_items and shown in the Rate
// Explorer; src/lib/construction-intelligence/duplicate-key.ts derives a
// further-flattened fingerprint from this for matching, but this function's
// own output stays readable.

// Whole-word abbreviation expansions common in South African BOQs. Order
// doesn't matter — each is a distinct word boundary match.
const ABBREVIATIONS: [pattern: RegExp, replacement: string][] = [
  [/\breinf\b/g, "reinforced"],
  [/\bconc\b/g, "concrete"],
  [/\bexcl\b/g, "excluding"],
  [/\bincl\b/g, "including"],
  [/\bc\/w\b/g, "complete with"],
  [/\bdia\b/g, "diameter"],
  [/\bthk\b/g, "thick"],
  [/\bqty\b/g, "quantity"],
  [/\bapprox\b/g, "approximately"],
  [/\bno\.\b/g, "number"],
  [/\bavg\b/g, "average"],
  [/\bmin\b/g, "minimum"],
  [/\bmax\b/g, "maximum"],
  [/\bexc\b/g, "excavation"],
  [/\bcompl\b/g, "complete"],
  [/\bhoriz\b/g, "horizontal"],
  [/\bvert\b/g, "vertical"],
];

/**
 * Produces one canonical, human-readable description for a construction line
 * item: lowercase, collapsed whitespace, stray punctuation stripped, common
 * abbreviations expanded, sentence-cased.
 */
export function normaliseDescription(raw: string): string {
  let text = raw.toLowerCase().trim();
  text = text.replace(/\s+/g, " ");
  // Keep word characters, whitespace, and the punctuation that carries real
  // meaning in a BOQ description (dimensions like "150x300mm", decimals,
  // fractions, percentages).
  text = text.replace(/[^\w\s.,/%-]/g, "");

  for (const [pattern, replacement] of ABBREVIATIONS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text === "") return text;

  return text.charAt(0).toUpperCase() + text.slice(1);
}
