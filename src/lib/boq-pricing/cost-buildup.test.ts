import { describe, expect, it } from "vitest";
import { calculateCostBuildup } from "./cost-buildup";

describe("calculateCostBuildup", () => {
  it("produces no lines and a zero rate when nothing is supplied", () => {
    const result = calculateCostBuildup({}, {});
    expect(result.directCostLines).toEqual([]);
    expect(result.markupLines).toEqual([]);
    expect(result.suggestedRate).toBe(0);
  });

  it("only includes a line for components that were actually supplied (supply-only item)", () => {
    const result = calculateCostBuildup({ materialCost: 120 }, { profitPercent: 10 });
    expect(result.directCostLines).toEqual([{ label: "Material", amount: 120 }]);
    expect(result.directCostSubtotal).toBe(120);
    expect(result.markupLines).toEqual([{ label: "Profit (10%)", amount: 12 }]);
    expect(result.suggestedRate).toBe(132);
  });

  it("applies wastage to material only, as its own visible line", () => {
    const result = calculateCostBuildup({ materialCost: 100, wastagePercent: 5 }, {});
    expect(result.directCostLines).toEqual([
      { label: "Material", amount: 100 },
      { label: "Wastage (5%)", amount: 5 },
    ]);
    expect(result.directCostSubtotal).toBe(105);
  });

  it("omits the wastage line when wastagePercent is 0 or unset", () => {
    const result = calculateCostBuildup({ materialCost: 100 }, {});
    expect(result.directCostLines).toEqual([{ label: "Material", amount: 100 }]);
  });

  it("includes labour/plant lines for an installation item with no material", () => {
    const result = calculateCostBuildup({ labourCost: 80, plantCost: 40 }, {});
    expect(result.directCostLines).toEqual([
      { label: "Labour", amount: 80 },
      { label: "Plant/equipment", amount: 40 },
    ]);
    expect(result.directCostSubtotal).toBe(120);
  });

  it("applies site overhead, head office overhead, and contingency as % of direct cost subtotal", () => {
    const result = calculateCostBuildup(
      { materialCost: 100 },
      { siteOverheadPercent: 8, headOfficeOverheadPercent: 5, contingencyPercent: 2 },
    );
    expect(result.markupLines).toEqual([
      { label: "Site overheads (8%)", amount: 8 },
      { label: "Head office overheads (5%)", amount: 5 },
      { label: "Contingency (2%)", amount: 2 },
    ]);
    // 100 + 8 + 5 + 2 = 115, no profit configured
    expect(result.suggestedRate).toBe(115);
  });

  it("applies profit last, cascading on cost + overheads + contingency, not on material alone", () => {
    const result = calculateCostBuildup(
      { materialCost: 100 },
      { siteOverheadPercent: 10, profitPercent: 10 },
    );
    // direct cost subtotal 100; +10% site overhead = 110; profit 10% of 110 = 11; total 121
    expect(result.markupLines).toEqual([
      { label: "Site overheads (10%)", amount: 10 },
      { label: "Profit (10%)", amount: 11 },
    ]);
    expect(result.suggestedRate).toBe(121);
  });

  it("combines every direct-cost component for a concrete-style item", () => {
    const result = calculateCostBuildup(
      {
        materialCost: 200,
        wastagePercent: 5,
        labourCost: 60,
        plantCost: 30,
        transportCost: 15,
      },
      { siteOverheadPercent: 8, profitPercent: 10 },
    );
    expect(result.directCostSubtotal).toBe(200 + 10 + 60 + 30 + 15); // 315
    expect(result.suggestedRate).toBeCloseTo(315 * 1.08 * 1.1);
  });
});
