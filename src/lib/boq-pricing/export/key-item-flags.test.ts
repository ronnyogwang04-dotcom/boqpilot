import { describe, expect, it } from "vitest";
import { flagKeyItems } from "./key-item-flags";
import type { ExportLineItem, StoredBenchmarkSnapshot } from "./types";

function makeItem(overrides: Partial<ExportLineItem> = {}): ExportLineItem {
  return {
    id: "1",
    itemCode: "1.1",
    description: "Generic item",
    unit: "m",
    quantity: 10,
    originalRate: 100,
    historicalBenchmarkRate: null,
    marketRate: null,
    labourAllowance: null,
    plantAllowance: null,
    overheadsAmount: null,
    profitAmount: null,
    recommendedRate: null,
    finalRate: null,
    amount: 1000,
    isConfirmed: true,
    pricingMethodKind: "manual",
    pricingMethodLabel: "User/tender-provided rate",
    confidence: "high",
    notes: null,
    flags: [],
    categoryDivision: "General",
    constructionCategory: "General",
    benchmarkEvidence: null,
    marketEvidence: null,
    costBuildupBreakdown: null,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<StoredBenchmarkSnapshot["bestMatch"]> = {}): StoredBenchmarkSnapshot {
  return {
    confidence: "strong",
    bestMatch: {
      id: "m1",
      description: "x",
      unit: "m",
      division: null,
      category: null,
      similarity: 0.8,
      score: 0.8,
      sampleCount: 3,
      projectCount: 2,
      avgRate: 100,
      medianRate: 100,
      minRate: 90,
      maxRate: 110,
      stddevRate: 5,
      mostRecentRate: 100,
      mostRecentRateAt: null,
      ...overrides,
    },
    evidence: [],
    inferredCategory: null,
    inferredUnit: null,
  };
}

describe("flagKeyItems", () => {
  it("flags the highest-value items by price magnitude", () => {
    const items = [
      makeItem({ id: "small", amount: 100 }),
      makeItem({ id: "big", amount: 90000 }),
    ];
    const flags = flagKeyItems(items);
    const magnitudeFlags = flags.filter((f) => f.reasonCategory === "price_magnitude");
    expect(magnitudeFlags.map((f) => f.itemId)).toContain("big");
  });

  it("flags provisional/PC sum items regardless of amount", () => {
    const items = [makeItem({ id: "prov", description: "Provisional sum for unforeseen works", amount: 5000 })];
    const flags = flagKeyItems(items);
    expect(flags.some((f) => f.itemId === "prov" && f.reasonCategory === "provisional_sum")).toBe(true);
  });

  it("flags specialist/branded keywords like pumps and generators", () => {
    const items = [
      makeItem({ id: "pump", description: "Supply and install submersible pump", amount: 8000 }),
      makeItem({ id: "generic", description: "Supply and fix skirting", amount: 8000 }),
    ];
    const flags = flagKeyItems(items).filter((f) => f.reasonCategory === "brand_dependence");
    expect(flags.map((f) => f.itemId)).toContain("pump");
    expect(flags.map((f) => f.itemId)).not.toContain("generic");
  });

  it("flags items with high historical price variation (stddev/avg above threshold)", () => {
    const items = [
      makeItem({ id: "volatile", benchmarkEvidence: makeSnapshot({ avgRate: 1000, stddevRate: 400 }) }), // cv = 0.4
      makeItem({ id: "stable", benchmarkEvidence: makeSnapshot({ avgRate: 1000, stddevRate: 20 }) }), // cv = 0.02
    ];
    const flags = flagKeyItems(items).filter((f) => f.reasonCategory === "market_volatility");
    expect(flags.map((f) => f.itemId)).toContain("volatile");
    expect(flags.map((f) => f.itemId)).not.toContain("stable");
  });

  it("flags materially significant items with weak/no evidence, but not trivial ones", () => {
    const items = [
      makeItem({ id: "material-weak", originalRate: 10000, quantity: 10, confidence: "review_required", amount: null }),
      makeItem({ id: "trivial-weak", originalRate: 1, quantity: 1, confidence: "review_required", amount: null }),
    ];
    const flags = flagKeyItems(items).filter((f) => f.reasonCategory === "limited_evidence");
    expect(flags.map((f) => f.itemId)).toContain("material-weak");
    expect(flags.map((f) => f.itemId)).not.toContain("trivial-weak");
  });

  it("does not flag an unremarkable, well-evidenced item that's a trivial share of a large BOQ", () => {
    const items = [
      makeItem({ id: "boring", description: "Supply and fix skirting", amount: 50, originalRate: 5, quantity: 10, confidence: "high" }),
      ...Array.from({ length: 5 }, (_, i) => makeItem({ id: `filler-${i}`, description: "Generic item", amount: 20000, originalRate: 2000, quantity: 10, confidence: "high" })),
    ];
    const flagsForBoring = flagKeyItems(items).filter((f) => f.itemId === "boring");
    expect(flagsForBoring).toEqual([]);
  });

  it("returns no flags for an empty BOQ", () => {
    expect(flagKeyItems([])).toEqual([]);
  });
});
