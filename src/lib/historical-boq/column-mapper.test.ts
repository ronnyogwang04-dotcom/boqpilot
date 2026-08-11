import { describe, expect, it } from "vitest";
import { detectHeaderRow } from "./column-mapper";

describe("detectHeaderRow", () => {
  it("finds a standard header row by alias", () => {
    const rows = [["Item", "Description", "Unit", "Qty", "Rate", "Amount"], ["1.1", "Excavate", "m³", 10, 50, 500]];
    const result = detectHeaderRow(rows);
    expect(result?.headerRowIndex).toBe(0);
    expect(result?.columnMap).toEqual({ code: 0, description: 1, unit: 2, quantity: 3, rate: 4, amount: 5 });
  });

  it("returns null when no row has both a description column and a measure column", () => {
    const rows = [["Priority 1"], ["1.1", "5 Classroom Block", "m²", 300, 7600, 2280000]];
    expect(detectHeaderRow(rows)).toBeNull();
  });

  it("infers Description from the single unclaimed gap column when every other role matches", () => {
    // Real Mjanyana header row: every alias matched except a garbled cell
    // sitting exactly where Description belongs.
    const rows = [
      [null, "SECTION", "BILL", "PAGE NO", "ITEM NO", "][td[rt]hy']", "UNIT", "QUANTITY", "RATE", "AMOUNT"],
    ];
    const result = detectHeaderRow(rows);
    expect(result?.headerRowIndex).toBe(0);
    expect(result?.columnMap).toEqual({ code: 4, description: 5, unit: 6, quantity: 7, rate: 8, amount: 9 });
  });

  it("does not guess when there is no Code/Item column to anchor the inference", () => {
    const rows = [[null, "some garbled cell", "Unit", "Qty", "Rate", "Amount"]];
    expect(detectHeaderRow(rows)).toBeNull();
  });

  it("does not guess when there are multiple unclaimed columns between Code and the nearest measure", () => {
    const rows = [["Item", "garbled 1", "garbled 2", "Unit", "Qty", "Rate", "Amount"]];
    expect(detectHeaderRow(rows)).toBeNull();
  });

  it("does not guess when there is no gap at all (Code sits directly next to the first measure column)", () => {
    const rows = [["Item", "Unit", "Qty", "Rate", "Amount"]];
    expect(detectHeaderRow(rows)).toBeNull();
  });
});
