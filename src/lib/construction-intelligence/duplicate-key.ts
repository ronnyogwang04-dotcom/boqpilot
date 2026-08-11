// Deterministic duplicate detection: two raw items are the same canonical
// construction item iff they produce the same key here. Never displayed —
// purely a fingerprint used to group rows in rate_library_items.

// Version-controlled for now; a future database-backed dictionary can
// replace this set without changing tokenise()'s signature.
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "and",
  "or",
  "with",
  "for",
  "from",
]);

/**
 * Tokenises a normalised description into its stopword-stripped words, in
 * their original order. Shared by buildDuplicateGroupKey() (which sorts
 * these for exact-match fingerprinting) and similarity.ts (which compares
 * token sets for near-duplicate detection).
 */
export function tokenise(normalisedDescription: string): string[] {
  return normalisedDescription
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

/**
 * Sorts the tokenised description alphabetically before joining — this
 * catches reordered phrasing ("installation of cable" vs "cable
 * installation") that a plain string comparison would treat as different
 * items. The normalised unit is prefixed so the same wording under a
 * different unit is never merged.
 */
export function buildDuplicateGroupKey(normalisedDescription: string, normalisedUnit: string | null): string {
  const tokens = tokenise(normalisedDescription).sort();
  return `${normalisedUnit ?? "?"}|${tokens.join(" ")}`;
}
