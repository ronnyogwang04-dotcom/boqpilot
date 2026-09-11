import { describe, expect, it } from "vitest";
import { buildEmbeddingInputText } from "./build-input-text";

const base = { normalisedUnit: "No", division: "Building Services", category: "Electrical" };

describe("buildEmbeddingInputText", () => {
  it("includes the description, unit, category and division", () => {
    const text = buildEmbeddingInputText({ ...base, normalisedDescription: "Supply and install distribution board" });
    expect(text).toBe("Supply and install distribution board. Unit: No. Category: Electrical (Building Services).");
  });

  it("doesn't stack a second '.' when the normalised description already ends with punctuation", () => {
    // Real example found in production data: normalise-description.ts often
    // leaves a trailing "." on its output (e.g. "Not exceeding 300 mm wide."),
    // which would otherwise produce "...  Unit: ..." — a double period.
    const text = buildEmbeddingInputText({ ...base, normalisedDescription: "Not exceeding 300 mm wide." });
    expect(text).toBe("Not exceeding 300 mm wide. Unit: No. Category: Electrical (Building Services).");
  });

  it("falls back to sensible defaults for missing fields", () => {
    const text = buildEmbeddingInputText({
      normalisedDescription: null,
      normalisedUnit: null,
      division: null,
      category: null,
    });
    expect(text).toBe("(no description). Unit: unspecified. Category: Uncategorised (Uncategorised).");
  });

  it("keeps genuinely different construction activities distinguishable (not collapsed to identical text)", () => {
    // The whole point: no LLM rewrite step means "supply", "install", and
    // "supply and install" variants never accidentally become the same
    // string, even though an embedding model may later judge them similar.
    const supplyOnly = buildEmbeddingInputText({ ...base, normalisedDescription: "Supply distribution board" });
    const installOnly = buildEmbeddingInputText({ ...base, normalisedDescription: "Install distribution board" });
    const supplyAndInstall = buildEmbeddingInputText({
      ...base,
      normalisedDescription: "Supply and install distribution board",
    });
    const repair = buildEmbeddingInputText({ ...base, normalisedDescription: "Repair distribution board" });
    const removal = buildEmbeddingInputText({ ...base, normalisedDescription: "Remove distribution board" });
    const testing = buildEmbeddingInputText({ ...base, normalisedDescription: "Testing of distribution board" });
    const commissioning = buildEmbeddingInputText({
      ...base,
      normalisedDescription: "Commissioning of distribution board",
    });

    const texts = [supplyOnly, installOnly, supplyAndInstall, repair, removal, testing, commissioning];
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("still equal-phrases text for genuinely equivalent wording variants (same normalised description)", () => {
    // Different raw phrasings of the SAME activity already normalise to the
    // same normalised_description upstream (normalise-description.ts) —
    // this function just needs to not introduce new divergence for
    // identical inputs.
    const a = buildEmbeddingInputText({ ...base, normalisedDescription: "Supply and install distribution board" });
    const b = buildEmbeddingInputText({ ...base, normalisedDescription: "Supply and install distribution board" });
    expect(a).toBe(b);
  });
});
