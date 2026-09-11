import { describe, expect, it } from "vitest";
import { classifyEmbeddingStatus, isEligibleForEmbedding, needsEmbedding } from "./eligibility";

describe("isEligibleForEmbedding", () => {
  it("is eligible when not merged and has at least one priced sample", () => {
    expect(isEligibleForEmbedding({ mergedIntoId: null, sampleCount: 1 })).toBe(true);
  });

  it("excludes merged-away canonical items", () => {
    expect(isEligibleForEmbedding({ mergedIntoId: "other-id", sampleCount: 5 })).toBe(false);
  });

  it("excludes canonical items with no priced sample — covers needs-review-only, headings, VAT, notes indirectly", () => {
    // sample_count only counts historical_boq_items rows with a non-null
    // unit_rate, and only row_type === "rate_item" && status !== "error"
    // rows ever get a canonical_item_id — so a zero sample_count here means
    // this canonical item never had a genuine priced rate_item behind it.
    expect(isEligibleForEmbedding({ mergedIntoId: null, sampleCount: 0 })).toBe(false);
  });
});

describe("classifyEmbeddingStatus", () => {
  const candidateText = "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).";

  it("is pending when there's no embedding and no prior error", () => {
    const status = classifyEmbeddingStatus(
      { embedding: null, embeddingInputText: null, embeddingLastError: null },
      candidateText,
    );
    expect(status).toBe("pending");
  });

  it("is failed when there's no embedding but a recorded prior error", () => {
    const status = classifyEmbeddingStatus(
      { embedding: null, embeddingInputText: null, embeddingLastError: "rate limited" },
      candidateText,
    );
    expect(status).toBe("failed");
  });

  it("is current when the embedding exists and its input text matches what would be generated now", () => {
    const status = classifyEmbeddingStatus(
      { embedding: [0.1, 0.2], embeddingInputText: candidateText, embeddingLastError: null },
      candidateText,
    );
    expect(status).toBe("current");
  });

  it("is stale when the embedding exists but the input text has drifted from what would be generated now", () => {
    const status = classifyEmbeddingStatus(
      { embedding: [0.1, 0.2], embeddingInputText: "an older, outdated input text", embeddingLastError: null },
      candidateText,
    );
    expect(status).toBe("stale");
  });
});

describe("needsEmbedding", () => {
  const candidateText = "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).";

  it("is false only when current — no duplicate work when nothing changed", () => {
    expect(
      needsEmbedding({ embedding: [0.1], embeddingInputText: candidateText, embeddingLastError: null }, candidateText),
    ).toBe(false);
  });

  it("is true for pending, stale, and failed", () => {
    expect(needsEmbedding({ embedding: null, embeddingInputText: null, embeddingLastError: null }, candidateText)).toBe(
      true,
    );
    expect(
      needsEmbedding({ embedding: [0.1], embeddingInputText: "stale text", embeddingLastError: null }, candidateText),
    ).toBe(true);
    expect(
      needsEmbedding({ embedding: null, embeddingInputText: null, embeddingLastError: "boom" }, candidateText),
    ).toBe(true);
  });
});
