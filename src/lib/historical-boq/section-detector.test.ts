import { describe, expect, it } from "vitest";
import { classifyRow } from "./section-detector";
import type { ColumnMap } from "./column-mapper";

// description=0, unit=1, quantity=2, rate=3, amount=4 — mirrors a typical
// detected column map.
const columnMap: ColumnMap = { description: 0, unit: 1, quantity: 2, rate: 3, amount: 4 };

describe("classifyRow", () => {
  it("classifies a blank row", () => {
    expect(classifyRow([null, null, null, null, null], columnMap)).toBe("blank");
  });

  it("classifies a genuine rate item (recognised unit + quantity + rate)", () => {
    expect(classifyRow(["Excavate trench for foundation", "m³", 120, 85.5, null], columnMap)).toBe("rate_item");
  });

  it("classifies an unpriced-but-real item (recognised unit + quantity, no rate yet)", () => {
    expect(classifyRow(["Supply and fix door", "No", 4, null, null], columnMap)).toBe("rate_item");
  });

  it("does NOT treat a JBCC clause heading with boilerplate unit=Item, qty=1, no price as a rate item", () => {
    // Real pattern found in the Khanyisa BOQ: every clause-heading row in
    // the Preliminaries section was pre-filled with unit "Item" and
    // quantity 1 from the template, with no rate.
    const row = ["A2\tOFFER, ACCEPTANCE AND PERFORMANCE", "Item", 1, null, null];
    expect(classifyRow(row, columnMap)).toBe("general_text");
  });

  it("still treats a genuinely priced lump-sum item as a rate item", () => {
    const row = ["Contractor's establishment on site", "Item", 1, 45000, 45000];
    expect(classifyRow(row, columnMap)).toBe("rate_item");
  });

  it("does NOT treat a JBCC clause reference like 'H1' sitting in the unit column as a real unit", () => {
    // This is the real-world false positive: a contractual-text row where a
    // clause reference ("H1", "H2") happens to land in whatever column the
    // sheet's header put at the unit position, with no quantity or price.
    const row = ['MEANING OF TERMS "TENDER / TENDERER"', "H1", null, null, null];
    expect(classifyRow(row, columnMap)).toBe("contractual_text");
  });

  it("classifies a subtotal row as subtotal_total even with numeric signals (stray qty=0, real amount)", () => {
    // Real pattern found in the Khanyisa BOQ: a "Sub Total" row with a
    // stray 0 in the quantity column and a genuine total in the amount
    // column otherwise passed the numeric heuristic alone.
    const row = ["Sub Total", "ST", 0, null, 15426];
    expect(classifyRow(row, columnMap)).toBe("subtotal_total");
  });

  it("classifies a VAT summary row as subtotal_total even with numeric signals (14 from '14%', a real amount)", () => {
    const row = ["Add Value Added Tax at the rate of 14%", "VAT", 14, null, 63840];
    expect(classifyRow(row, columnMap)).toBe("subtotal_total");
  });

  it("classifies bill and section headings even when a stray value sits in another column", () => {
    expect(classifyRow(["BILL NO 1", null, null, null, null], columnMap)).toBe("bill_heading");
    expect(classifyRow(["SECTION NO 1", null, null, null, null], columnMap)).toBe("section_heading");
  });

  it("classifies a preliminaries heading", () => {
    expect(classifyRow(["PRELIMINARIES", null, null, null, null], columnMap)).toBe("preliminary_general");
  });

  it("falls back to general_text for a row with no measures and no matching pattern", () => {
    expect(classifyRow(["Some unrelated paragraph", null, null, null, null], columnMap)).toBe("general_text");
  });

  it("does not treat a heading with literal 0/0 boilerplate as a rate item (real Mjanyana pattern)", () => {
    // Real row: ["FLOORS AND FLOOR FINISHES", "H2", 0, null, 0] — a
    // sub-section heading, not an item, despite having "quantity" and
    // "amount" cells that are both non-null (just zero).
    const row = ["FLOORS AND FLOOR FINISHES", "H2", 0, null, 0];
    expect(classifyRow(row, columnMap)).toBe("general_text");
  });

  it("does not treat a cross-reference note with amount=0 as a rate item (real Tyali pattern)", () => {
    const row = ["Part B - Electrical Installation (See separate document)", "Item", 1, null, 0];
    expect(classifyRow(row, columnMap)).toBe("general_text");
  });

  it("excludes an H-coded row with a stray rate but zero quantity — one signal alone still isn't enough", () => {
    // The one exception found among 760 real Mjanyana H-coded rows: quantity
    // 0 (now treated as absent) and an unrecognised unit leave only the rate
    // as a single signal, which was never sufficient on its own (see
    // isLikelyRateItem's "at least two corroborating signals" rule) — so
    // this stays excluded too, which is the right call for a row this
    // ambiguous (spec-like text with a stray rate, no real quantity).
    const row = ["One coat type III wood primer, one undercoat and two coats acrylic paint.", "H3", 0, 60, 0];
    expect(classifyRow(row, columnMap)).toBe("general_text");
  });

  it("classifies a bills-summary/index row (unit 'Page') as non-rate even with a real page number and total", () => {
    // Real Mjanyana "Bills Summary" row: quantity is actually a page number,
    // amount is a bill grand-total — both genuinely non-zero, so only the
    // definitive unit check (not the zero-value fix) catches this.
    const row = ["Ironmongery", "Page", 133, 0, 1271202.56];
    expect(classifyRow(row, columnMap)).toBe("subtotal_total");
  });

  it("classifies a NOTE: row as note_specification even with stray numeric signals", () => {
    const row = ["NOTE: The following items shall be deemed to fall into Work Group No 114", null, 0, null, 0];
    expect(classifyRow(row, columnMap)).toBe("note_specification");
  });

  it("classifies a VAT summary row (unit 'VAT') as non-rate even when the description alone gives no hint", () => {
    // Real Tyali row: description is just "ADD" — too generic to match the
    // description-based VAT pattern — but the unit column literally holds
    // "VAT" alongside a real, non-zero computed tax amount.
    const row = ["ADD", "VAT", null, null, 63840];
    expect(classifyRow(row, columnMap)).toBe("subtotal_total");
  });
});
