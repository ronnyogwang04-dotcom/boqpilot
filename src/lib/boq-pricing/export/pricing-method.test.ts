import { describe, expect, it } from "vitest";
import { resolveExportLineItem } from "./pricing-method";
import type { ExportLineItemInput, StoredBenchmarkSnapshot } from "./types";

function baseInput(overrides: Partial<ExportLineItemInput> = {}): ExportLineItemInput {
  return {
    id: "item-1",
    itemCode: "1.1",
    description: "Supply and install distribution board",
    unit: "No",
    quantity: 2,
    originalRate: 4000,
    categoryDivision: "Building Services",
    constructionCategory: "Electrical",
    estimatorRate: null,
    rateSource: null,
    rateNotes: null,
    costBuildupComponents: null,
    costBuildupMarkups: null,
    benchmarkSnapshot: null,
    systemSuggestedSnapshot: null,
    marketResearchSnapshot: null,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<StoredBenchmarkSnapshot> = {}): StoredBenchmarkSnapshot {
  return {
    confidence: "strong",
    bestMatch: {
      id: "match-1",
      description: "Supply and install distribution board",
      unit: "No",
      division: "Building Services",
      category: "Electrical",
      similarity: 0.82,
      score: 0.82,
      sampleCount: 4,
      projectCount: 3,
      avgRate: 4600,
      medianRate: 4550,
      minRate: 4200,
      maxRate: 5000,
      stddevRate: 300,
      mostRecentRate: 4750,
      mostRecentRateAt: "2026-01-01T00:00:00Z",
    },
    evidence: [],
    inferredCategory: "Electrical",
    inferredUnit: "No",
    ...overrides,
  };
}

describe("resolveExportLineItem", () => {
  it("uses the saved benchmark snapshot's average rate for a confirmed historical decision", () => {
    const result = resolveExportLineItem(
      baseInput({ estimatorRate: 4600, rateSource: "historical", benchmarkSnapshot: makeSnapshot() }),
    );

    expect(result.isConfirmed).toBe(true);
    expect(result.pricingMethodKind).toBe("historical");
    expect(result.historicalBenchmarkRate).toBe(4600);
    expect(result.recommendedRate).toBe(4600);
    expect(result.finalRate).toBe(4600);
    expect(result.confidence).toBe("high");
    expect(result.amount).toBe(9200); // 4600 * qty 2
  });

  it("recomputes the cost build-up breakdown for a confirmed build_up decision, never a blanket markup", () => {
    const result = resolveExportLineItem(
      baseInput({
        estimatorRate: 1250,
        rateSource: "build_up",
        costBuildupComponents: { materialCost: 800, labourCost: 200, plantCost: 50 },
        costBuildupMarkups: { siteOverheadPercent: 8, profitPercent: 10 },
      }),
    );

    expect(result.pricingMethodKind).toBe("build_up");
    expect(result.labourAllowance).toBe(200);
    expect(result.plantAllowance).toBe(50);
    expect(result.overheadsAmount).toBeCloseTo(1050 * 0.08);
    expect(result.profitAmount).not.toBeNull();
    expect(result.confidence).toBe("medium");
  });

  it("leaves labour/plant/overheads/profit null when no build-up was captured for the item", () => {
    const result = resolveExportLineItem(baseInput({ estimatorRate: 500, rateSource: "manual" }));

    expect(result.labourAllowance).toBeNull();
    expect(result.plantAllowance).toBeNull();
    expect(result.overheadsAmount).toBeNull();
    expect(result.profitAmount).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.flags).toContain("No evidence trail captured for this rate");
  });

  it("uses the cached system suggestion for an undecided item, marked not confirmed", () => {
    const result = resolveExportLineItem(baseInput({ systemSuggestedSnapshot: makeSnapshot({ confidence: "weak" }) }));

    expect(result.isConfirmed).toBe(false);
    expect(result.finalRate).toBeNull();
    expect(result.recommendedRate).toBe(4600);
    expect(result.confidence).toBe("low");
    expect(result.pricingMethodKind).toBe("system_suggested");
    expect(result.flags).toContain("Not yet reviewed by estimator");
  });

  it("never invents a rate when there is no evidence at all — flags for review instead", () => {
    const result = resolveExportLineItem(baseInput());

    expect(result.recommendedRate).toBeNull();
    expect(result.finalRate).toBeNull();
    expect(result.amount).toBeNull();
    expect(result.confidence).toBe("review_required");
    expect(result.pricingMethodKind).toBe("insufficient_data");
    expect(result.flags).toContain("Insufficient evidence to safely recommend a rate");
  });

  it("does not claim a rate when a system suggestion exists but found no reliable match (confidence none)", () => {
    const result = resolveExportLineItem(baseInput({ systemSuggestedSnapshot: makeSnapshot({ confidence: "none", bestMatch: null }) }));

    expect(result.recommendedRate).toBeNull();
    expect(result.pricingMethodKind).toBe("insufficient_data");
    expect(result.confidence).toBe("review_required");
  });

  it("falls back to the original tender amount basis when quantity is missing (amount stays null)", () => {
    const result = resolveExportLineItem(baseInput({ quantity: null, estimatorRate: 100, rateSource: "manual" }));
    expect(result.amount).toBeNull();
  });
});
