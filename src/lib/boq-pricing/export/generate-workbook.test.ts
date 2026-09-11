import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateWorkbook } from "./generate-workbook";
import { buildExportData } from "./build-export-data";
import type { ExportLineItemInput, MarkupDefaults } from "./types";

const markupDefaults: MarkupDefaults = {
  wastagePercent: 5,
  siteOverheadPercent: 8,
  headOfficeOverheadPercent: 5,
  profitPercent: 10,
  contingencyPercent: 0,
};

const meta = { projectName: "Riverside Clinic", boqName: "Riverside Clinic BOQ.xlsx", dateProcessed: "2026-08-14" };

/** exceljs's shipped .d.ts predates @types/node's generic Buffer<TArrayBuffer> — a type-only mismatch, not a runtime one. */
async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function fixtureInputs(): ExportLineItemInput[] {
  return [
    {
      id: "hist-1",
      itemCode: "2.1",
      description: "Supply and install distribution board",
      unit: "No",
      quantity: 2,
      originalRate: 4000,
      categoryDivision: "Building Services",
      constructionCategory: "Electrical",
      estimatorRate: 4600,
      rateSource: "historical",
      rateNotes: "Matches recent similar project",
      costBuildupComponents: null,
      costBuildupMarkups: null,
      benchmarkSnapshot: {
        confidence: "strong",
        bestMatch: {
          id: "m1",
          description: "Distribution board",
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
      },
      systemSuggestedSnapshot: null,
      marketResearchSnapshot: null,
    },
    {
      id: "buildup-1",
      itemCode: "3.1",
      description: "Supply and lay 25MPa concrete in slab",
      unit: "m3",
      quantity: 40,
      originalRate: 1900,
      categoryDivision: "Structural Works",
      constructionCategory: "Concrete & Formwork",
      estimatorRate: 2050,
      rateSource: "build_up",
      rateNotes: null,
      costBuildupComponents: { materialCost: 1500, wastagePercent: 5, labourCost: 300, plantCost: 100 },
      costBuildupMarkups: { siteOverheadPercent: 8, profitPercent: 10 },
      benchmarkSnapshot: null,
      systemSuggestedSnapshot: null,
      marketResearchSnapshot: null,
    },
    {
      id: "unpriced-1",
      itemCode: "4.1",
      description: "Provisional sum for generator supply and install",
      unit: "Item",
      quantity: 1,
      originalRate: null,
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
    },
  ];
}

describe("generateWorkbook", () => {
  it("produces a readable .xlsx buffer with all six sheets in order", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);

    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      "Estimator Report",
      "Priced BOQ",
      "Cost Build-Up Analysis",
      "Review and Double-Check",
      "Sources and Research",
      "Pricing Notes and Assumptions",
    ]);
  });

  it("freezes the header row on the Priced BOQ sheet and lists every line item plus a totals row", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Priced BOQ")!;
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getRow(1).getCell(1).value).toBe("Item Code");

    // header + 3 items + totals row
    expect(sheet.rowCount).toBe(1 + 3 + 1);
    const totalsRow = sheet.getRow(sheet.rowCount);
    expect(totalsRow.getCell(2).value).toBe("TOTAL");
  });

  it("shows the confirmed historical item's real numbers on the Priced BOQ sheet, not fabricated ones", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Priced BOQ")!;
    const row = sheet.getRow(2); // first data row = hist-1
    expect(row.getCell(1).value).toBe("2.1");
    expect(row.getCell(6).value).toBe(9200); // amount = 4600 * 2
    expect(row.getCell(16).value).toBe("High"); // confidence
  });

  it("leaves the recommended/final rate blank (not zero, not invented) for an unpriced item with no evidence", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Priced BOQ")!;
    const row = sheet.getRow(4); // unpriced-1
    expect(row.getCell(5).value).toBeNull(); // recommended rate
    expect(row.getCell(14).value).toBeNull(); // final rate
    expect(row.getCell(16).value).toBe("Review Required");
  });

  it("lists the build-up item's cost breakdown lines on the Pricing Analysis sheet", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Cost Build-Up Analysis")!;
    const values: string[] = [];
    sheet.eachRow((row) => {
      const label = row.getCell(3).value;
      if (typeof label === "string") values.push(label);
    });
    expect(values).toContain("Material");
    expect(values).toContain("Labour");
  });

  it("lists the provisional-sum item on the Review and Double-Check sheet", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Review and Double-Check")!;
    let found = false;
    sheet.eachRow((row) => {
      const cell = row.getCell(1).value;
      if (typeof cell === "string" && cell.includes("generator")) found = true;
    });
    expect(found).toBe(true);
  });

  it("records the historical evidence source for the confirmed item on the Sources sheet", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Sources and Research")!;
    const row = sheet.getRow(2);
    expect(row.getCell(2).value).toContain("confirmed");
    expect(row.getCell(7).value).toBe(4600); // avg rate
  });

  it("includes the honest current-market-research status note even when no online items exist", async () => {
    const data = buildExportData(fixtureInputs(), meta, markupDefaults);
    const buffer = await generateWorkbook(data);
    const workbook = await loadWorkbook(buffer);

    const sheet = workbook.getWorksheet("Pricing Notes and Assumptions")!;
    let found = false;
    sheet.eachRow((row) => {
      const value = row.getCell(2).value;
      if (typeof value === "string" && /no item.*has a saved rate sourced from current market/i.test(value)) found = true;
    });
    expect(found).toBe(true);
  });

  it("handles an empty BOQ without throwing", async () => {
    const data = buildExportData([], meta, markupDefaults);
    await expect(generateWorkbook(data)).resolves.toBeInstanceOf(Buffer);
  });
});
