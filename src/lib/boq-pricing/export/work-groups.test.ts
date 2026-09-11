import { describe, expect, it } from "vitest";
import { buildWorkGroupSummary } from "./work-groups";
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
    confidence: "low",
    notes: null,
    flags: [],
    categoryDivision: "Structural Works",
    constructionCategory: "Concrete & Formwork",
    benchmarkEvidence: null,
    marketEvidence: null,
    costBuildupBreakdown: null,
    ...overrides,
  };
}

describe("buildWorkGroupSummary", () => {
  it("sums amounts and counts per division, ranked by financial impact descending", () => {
    const items = [
      makeItem({ categoryDivision: "Structural Works", amount: 1000 }),
      makeItem({ categoryDivision: "Structural Works", amount: 2000 }),
      makeItem({ categoryDivision: "Building Services", amount: 5000 }),
    ];

    const groups = buildWorkGroupSummary(items);

    expect(groups[0]).toMatchObject({ division: "Building Services", itemCount: 1, totalAmount: 5000 });
    expect(groups[1]).toMatchObject({ division: "Structural Works", itemCount: 2, totalAmount: 3000 });
  });

  it("counts priced vs review-required items per division", () => {
    const items = [
      makeItem({ categoryDivision: "General", isConfirmed: true, confidence: "high" }),
      makeItem({ categoryDivision: "General", isConfirmed: false, confidence: "review_required", amount: null }),
    ];

    const [group] = buildWorkGroupSummary(items);

    expect(group.pricedItemCount).toBe(1);
    expect(group.reviewRequiredCount).toBe(1);
    expect(group.itemCount).toBe(2);
  });

  it("treats a null amount as zero rather than throwing or dropping the item", () => {
    const items = [makeItem({ amount: null })];
    const [group] = buildWorkGroupSummary(items);
    expect(group.totalAmount).toBe(0);
    expect(group.itemCount).toBe(1);
  });

  it("returns an empty list for no items", () => {
    expect(buildWorkGroupSummary([])).toEqual([]);
  });
});
