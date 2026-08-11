import { tokenise } from "./duplicate-key";

/**
 * Jaccard token-overlap similarity between two normalised descriptions, in
 * [0, 1]. Deliberately not used anywhere in the automatic
 * normalise -> dedupe -> insert pipeline — buildDuplicateGroupKey() stays
 * the sole automatic mechanism, since a silent fuzzy merge could combine
 * two genuinely different items. This is only for surfacing "possible
 * duplicate" suggestions to a human admin, who decides whether to merge.
 */
export function describeSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenise(a));
  const tokensB = new Set(tokenise(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize++;
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return intersectionSize / unionSize;
}
