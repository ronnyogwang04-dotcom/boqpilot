import { describe, expect, it } from "vitest";
import { classifyConfidence, confidenceThresholds } from "./confidence";
import type { SemanticSearchResult } from "@/lib/embeddings/semantic-search";

function makeMatch(overrides: Partial<SemanticSearchResult> = {}): SemanticSearchResult {
  return {
    id: "1",
    description: "Reinforced concrete 25mpa in slab",
    unit: "m³",
    division: "Structural Works",
    category: "Concrete & Formwork",
    similarity: 0.8,
    score: 0.8,
    sampleCount: 3,
    projectCount: 2,
    avgRate: 2000,
    medianRate: 2000,
    minRate: 1800,
    maxRate: 2200,
    stddevRate: 100,
    mostRecentRate: 2100,
    mostRecentRateAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("classifyConfidence", () => {
  it("returns none when there is no match at all", () => {
    expect(classifyConfidence(null, "m³")).toBe("none");
  });

  it("returns strong for high similarity, compatible unit, and enough samples", () => {
    const match = makeMatch({ similarity: 0.8, unit: "m³", sampleCount: 3 });
    expect(classifyConfidence(match, "m³")).toBe("strong");
  });

  it("does not return strong with only 1 sample, even at high similarity — falls to reasonable", () => {
    const match = makeMatch({ similarity: 0.8, unit: "m³", sampleCount: 1 });
    expect(classifyConfidence(match, "m³")).toBe("reasonable");
  });

  it("returns reasonable for mid-range similarity with a compatible unit", () => {
    const match = makeMatch({ similarity: 0.68, unit: "m³", sampleCount: 5 });
    expect(classifyConfidence(match, "m³")).toBe("reasonable");
  });

  it("never returns strong or reasonable when the unit is incompatible, however high the similarity", () => {
    // The exact "don't recommend an m² rate for an item priced per m" case.
    const match = makeMatch({ similarity: 0.85, unit: "m²", sampleCount: 10 });
    const confidence = classifyConfidence(match, "m");
    expect(confidence).not.toBe("strong");
    expect(confidence).not.toBe("reasonable");
    expect(confidence).toBe("weak");
  });

  it("returns weak for low-but-present similarity", () => {
    const match = makeMatch({ similarity: 0.6, unit: "m³", sampleCount: 1 });
    expect(classifyConfidence(match, "m³")).toBe("weak");
  });

  it("returns none below the weak threshold", () => {
    const match = makeMatch({ similarity: 0.4 });
    expect(classifyConfidence(match, "m³")).toBe("none");
  });

  it("treats a query with no known unit as compatible with anything (nothing to compare)", () => {
    const match = makeMatch({ similarity: 0.8, unit: "m³", sampleCount: 3 });
    expect(classifyConfidence(match, null)).toBe("strong");
  });

  it("treats a candidate with no recorded unit as compatible (can't penalise a signal that isn't there)", () => {
    const match = makeMatch({ similarity: 0.8, unit: null, sampleCount: 3 });
    expect(classifyConfidence(match, "m³")).toBe("strong");
  });

  it("is case-insensitive when comparing units", () => {
    const match = makeMatch({ similarity: 0.8, unit: "No", sampleCount: 3 });
    expect(classifyConfidence(match, "no")).toBe("strong");
  });

  it("exposes the thresholds it uses so callers/tests stay in sync with the real values", () => {
    expect(confidenceThresholds.strongSimilarity).toBeGreaterThan(confidenceThresholds.reasonableSimilarity);
    expect(confidenceThresholds.reasonableSimilarity).toBeGreaterThan(confidenceThresholds.weakSimilarity);
  });
});
