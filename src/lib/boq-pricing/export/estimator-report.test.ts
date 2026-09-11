import { describe, expect, it } from "vitest";
import { buildEstimatorReportSummary } from "./estimator-report";
import type { ExportLineItem } from "./types";

function makeItem(overrides: Partial<ExportLineItem> = {}): ExportLineItem {
  return {
    id: "1",
    itemCode: null,
    description: "x",
    unit: "m",
    quantity: 1,
    originalRate: null,
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

const meta = { projectName: "Test Project", boqName: "Test BOQ", dateProcessed: "2026-08-14" };

describe("buildEstimatorReportSummary", () => {
  it("sums total BOQ value across all items", () => {
    const summary = buildEstimatorReportSummary([makeItem({ amount: 1000 }), makeItem({ amount: 2500 })], meta);
    expect(summary.totalBoqValue).toBe(3500);
    expect(summary.totalItems).toBe(2);
  });

  it("counts priced vs unpriced items", () => {
    const summary = buildEstimatorReportSummary(
      [makeItem({ isConfirmed: true }), makeItem({ isConfirmed: false, amount: null, confidence: "review_required" })],
      meta,
    );
    expect(summary.pricedItems).toBe(1);
  });

  it("counts and values historical-benchmarked items, including system-suggested (not yet confirmed) ones", () => {
    const summary = buildEstimatorReportSummary(
      [
        makeItem({ pricingMethodKind: "historical", amount: 1000 }),
        makeItem({ pricingMethodKind: "system_suggested", isConfirmed: false, amount: 2000 }),
        makeItem({ pricingMethodKind: "manual", amount: 500 }),
      ],
      meta,
    );
    expect(summary.historicalBenchmarkedCount).toBe(2);
    expect(summary.historicalBenchmarkedValue).toBe(3000);
  });

  it("does not double-count an item that is both unconfirmed and review_required in reviewRequiredItems", () => {
    const summary = buildEstimatorReportSummary(
      [makeItem({ isConfirmed: false, confidence: "review_required", amount: null })],
      meta,
    );
    expect(summary.reviewRequiredItems).toBe(1);
  });

  it("breaks down count and value by confidence level, covering every level even with zero items", () => {
    const summary = buildEstimatorReportSummary([makeItem({ confidence: "high", amount: 1000 })], meta);
    expect(summary.confidenceBreakdown.high).toEqual({ count: 1, value: 1000 });
    expect(summary.confidenceBreakdown.medium).toEqual({ count: 0, value: 0 });
    expect(summary.confidenceBreakdown.low).toEqual({ count: 0, value: 0 });
    expect(summary.confidenceBreakdown.review_required).toEqual({ count: 0, value: 0 });
  });

  it("carries through project metadata unchanged", () => {
    const summary = buildEstimatorReportSummary([], meta);
    expect(summary.projectName).toBe("Test Project");
    expect(summary.boqName).toBe("Test BOQ");
    expect(summary.dateProcessed).toBe("2026-08-14");
    expect(summary.totalItems).toBe(0);
  });
});
