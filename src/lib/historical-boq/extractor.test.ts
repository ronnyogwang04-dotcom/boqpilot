import { describe, expect, it } from "vitest";
import { extractItemsFromDocument } from "./extractor";
import type { ParsedDocument } from "./types";

// Mirrors the real-world shape reported from the Khanyisa BOQ: section/bill
// headings, a "PRELIMINARIES" heading, a JBCC definitions clause with a
// clause reference ("H1") sitting in the unit column, a genuine priced
// item, and a subtotal row — all under one header row.
function buildDocument(): ParsedDocument {
  return {
    sheets: [
      {
        name: "Bill 1",
        rows: [
          ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
          ["", "SECTION NO 1", "", "", "", ""],
          ["", "BILL NO 1: PRELIMINARIES", "", "", "", ""],
          ["", "PRELIMINARIES", "", "", "", ""],
          ["", 'MEANING OF TERMS "TENDER / TENDERER"', "H1", "", "", ""],
          ["1.1", "Excavate trench for foundation", "m³", 120, 85.5, ""],
          ["", "Sub-total carried forward", "", "", "", 10260],
        ],
      },
    ],
  };
}

describe("extractItemsFromDocument (real-data regression)", () => {
  const { items, summary } = extractItemsFromDocument(buildDocument());

  it("classifies every non-blank row, tagging each with its row_type", () => {
    expect(items.map((item) => item.rowType)).toEqual([
      "section_heading",
      "bill_heading",
      "preliminary_general",
      "contractual_text",
      "rate_item",
      "subtotal_total",
    ]);
  });

  it("never lets a clause reference like 'H1' promote contractual text to a rate item", () => {
    const clauseRow = items.find((item) => item.description.startsWith("MEANING OF TERMS"))!;
    expect(clauseRow.rowType).toBe("contractual_text");
    expect(clauseRow.unit).toBeNull();
    expect(clauseRow.category).toBeNull();
    expect(clauseRow.status).toBe("ok");
    // The raw "H1" is still recoverable from rawRow for audit, even though
    // it was never trusted as a structured unit.
    expect(clauseRow.rawRow).toContain("H1");
  });

  it("only assigns a construction category to the genuine rate item, never to headings or contractual text", () => {
    const nonItems = items.filter((item) => item.rowType !== "rate_item");
    expect(nonItems.every((item) => item.category === null)).toBe(true);

    const rateItem = items.find((item) => item.rowType === "rate_item")!;
    expect(rateItem.category).toBe("Earthworks");
  });

  it("tracks section context only through real headings, not through contractual text or subtotals", () => {
    const rateItem = items.find((item) => item.rowType === "rate_item")!;
    expect(rateItem.section).toBe("PRELIMINARIES");

    const subtotalRow = items.find((item) => item.rowType === "subtotal_total")!;
    expect(subtotalRow.section).toBe("PRELIMINARIES");
  });

  it("only counts genuine rate items toward rowsDetected", () => {
    expect(summary.rowsDetected).toBe(1);
    expect(summary.rowsExtracted).toBe(items.length);
  });
});
