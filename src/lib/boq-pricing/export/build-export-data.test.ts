import { describe, expect, it } from "vitest";
import { buildExportData } from "./build-export-data";
import type { ExportLineItemInput, MarkupDefaults } from "./types";

function makeInput(overrides: Partial<ExportLineItemInput> = {}): ExportLineItemInput {
  return {
    id: "1",
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

const markupDefaults: MarkupDefaults = {
  wastagePercent: 5,
  siteOverheadPercent: 8,
  headOfficeOverheadPercent: 5,
  profitPercent: 10,
  contingencyPercent: 0,
};

const meta = { projectName: "Test Project", boqName: "Test BOQ.xlsx", dateProcessed: "2026-08-14" };

describe("buildExportData", () => {
  it("resolves raw inputs into line items and keeps every derived sheet consistent with them", () => {
    const inputs = [
      makeInput({ id: "a", estimatorRate: 4500, rateSource: "manual" }),
      makeInput({ id: "b" }),
    ];

    const data = buildExportData(inputs, meta, markupDefaults);

    expect(data.lineItems).toHaveLength(2);
    expect(data.projectName).toBe("Test Project");
    expect(data.boqName).toBe("Test BOQ.xlsx");
    expect(data.report.totalItems).toBe(2);
    expect(data.markupDefaults).toBe(markupDefaults);
  });

  it("carries a confirmed historical item through to the work-group summary and report totals", () => {
    const inputs = [
      makeInput({
        id: "hist",
        estimatorRate: 4600,
        rateSource: "historical",
        benchmarkSnapshot: {
          confidence: "strong",
          bestMatch: {
            id: "m1",
            description: "x",
            unit: "No",
            division: "Building Services",
            category: "Electrical",
            similarity: 0.8,
            score: 0.8,
            sampleCount: 3,
            projectCount: 2,
            avgRate: 4600,
            medianRate: 4600,
            minRate: 4200,
            maxRate: 5000,
            stddevRate: 200,
            mostRecentRate: 4600,
            mostRecentRateAt: null,
          },
          evidence: [],
          inferredCategory: "Electrical",
          inferredUnit: "No",
        },
      }),
    ];

    const data = buildExportData(inputs, meta, markupDefaults);

    expect(data.workGroups).toHaveLength(1);
    expect(data.workGroups[0].division).toBe("Building Services");
    expect(data.workGroups[0].totalAmount).toBe(9200);
    expect(data.report.historicalBenchmarkedCount).toBe(1);
  });

  it("produces no key-item flags or pricing notes crashes for an empty BOQ", () => {
    const data = buildExportData([], meta, markupDefaults);
    expect(data.lineItems).toEqual([]);
    expect(data.workGroups).toEqual([]);
    expect(data.keyItemFlags).toEqual([]);
    expect(data.pricingNotes.length).toBeGreaterThan(0); // still reports honest online-research status
  });
});
