import { describe, expect, it } from "vitest";
import { buildPricingNotes } from "./pricing-notes";
import type { ExportLineItem, MarkupDefaults } from "./types";

function makeItem(overrides: Partial<ExportLineItem> = {}): ExportLineItem {
  return {
    id: "1",
    itemCode: "1.1",
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
    amount: 100,
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

const markupDefaults: MarkupDefaults = {
  wastagePercent: 5,
  siteOverheadPercent: 8,
  headOfficeOverheadPercent: 5,
  profitPercent: 10,
  contingencyPercent: 0,
};

describe("buildPricingNotes", () => {
  it("notes how many items were priced from historical evidence", () => {
    const notes = buildPricingNotes([makeItem({ pricingMethodKind: "historical" })], markupDefaults);
    expect(notes.some((n) => n.category === "Historical evidence" && n.detail.includes("1 item"))).toBe(true);
  });

  it("notes weak/missing evidence items with concrete examples", () => {
    const notes = buildPricingNotes([makeItem({ confidence: "review_required", itemCode: "2.3" })], markupDefaults);
    const note = notes.find((n) => n.category === "Weak or missing evidence");
    expect(note?.detail).toContain("2.3");
  });

  it("notes markup assumptions only when a build-up item exists", () => {
    const withBuildUp = buildPricingNotes([makeItem({ pricingMethodKind: "build_up" })], markupDefaults);
    expect(withBuildUp.some((n) => n.category === "Markup assumptions")).toBe(true);

    const withoutBuildUp = buildPricingNotes([makeItem({ pricingMethodKind: "manual" })], markupDefaults);
    expect(withoutBuildUp.some((n) => n.category === "Markup assumptions")).toBe(false);
  });

  it("always mentions current market/material research status honestly, even when none was used", () => {
    const notes = buildPricingNotes([makeItem()], markupDefaults);
    const note = notes.find((n) => n.category === "Current market / material research");
    expect(note).toBeDefined();
    expect(note?.detail).toMatch(/no item.*has a saved rate sourced from current market/i);
  });

  it("flags missing unit and missing quantity items", () => {
    const notes = buildPricingNotes([makeItem({ unit: null }), makeItem({ quantity: null })], markupDefaults);
    expect(notes.some((n) => n.category === "Missing unit")).toBe(true);
    expect(notes.some((n) => n.category === "Missing quantity")).toBe(true);
  });

  it("returns notes even for an empty BOQ without throwing", () => {
    expect(() => buildPricingNotes([], markupDefaults)).not.toThrow();
  });
});
