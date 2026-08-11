import { describe, expect, it } from "vitest";
import { classifyNonRateRowType, isDefinitiveNonRateUnit, isLikelyRateItem, matchDefinitiveRowType } from "./row-type";

describe("matchDefinitiveRowType", () => {
  it("matches bill/section headings and subtotal rows unconditionally on text alone", () => {
    expect(matchDefinitiveRowType("BILL NO 1")).toBe("bill_heading");
    expect(matchDefinitiveRowType("SECTION NO 1")).toBe("section_heading");
    expect(matchDefinitiveRowType("Sub Total")).toBe("subtotal_total");
    expect(matchDefinitiveRowType("Add Value Added Tax at the rate of 14%")).toBe("subtotal_total");
  });

  it("matches NOTE: and N.B. prefixes unconditionally, but not Specification", () => {
    expect(matchDefinitiveRowType("NOTE: The following items shall be deemed to fall into Work Group No 114")).toBe(
      "note_specification",
    );
    expect(matchDefinitiveRowType("N.B. rates are to include for all fixing accessories")).toBe("note_specification");
    // "Specification" stays contextual — a real priced item can legitimately
    // start its description with it.
    expect(matchDefinitiveRowType("Specification of materials and methods to be used")).toBeNull();
  });

  it("returns null for text that isn't one of the unambiguous patterns", () => {
    expect(matchDefinitiveRowType("PRELIMINARIES")).toBeNull();
    expect(matchDefinitiveRowType("Excavate trench for foundation")).toBeNull();
  });
});

describe("isDefinitiveNonRateUnit", () => {
  it("recognises 'Page' regardless of case/whitespace", () => {
    expect(isDefinitiveNonRateUnit("Page")).toBe(true);
    expect(isDefinitiveNonRateUnit(" PAGE ")).toBe(true);
    expect(isDefinitiveNonRateUnit("page")).toBe(true);
  });

  it("recognises 'VAT' regardless of case/whitespace", () => {
    // Real Tyali row: description "ADD" (too generic to match the
    // description-based VAT pattern), unit "VAT", with a real computed tax
    // amount — only a unit-based check catches this one.
    expect(isDefinitiveNonRateUnit("VAT")).toBe(true);
    expect(isDefinitiveNonRateUnit(" vat ")).toBe(true);
  });

  it("is false for a real unit or null", () => {
    expect(isDefinitiveNonRateUnit("m³")).toBe(false);
    expect(isDefinitiveNonRateUnit(null)).toBe(false);
  });
});

describe("isLikelyRateItem", () => {
  it("requires at least two corroborating signals, not just one", () => {
    // A lone recognised-unit-looking token with nothing else is not enough —
    // this is what a JBCC clause reference landing in the unit column looks
    // like on paper.
    expect(isLikelyRateItem({ quantity: null, unit: "m³", rate: null, amount: null })).toBe(false);
    expect(isLikelyRateItem({ quantity: 5, unit: null, rate: null, amount: null })).toBe(false);
  });

  it("qualifies quantity + a measured unit even with no price yet (legitimately unpriced item)", () => {
    expect(isLikelyRateItem({ quantity: 5, unit: "m³", rate: null, amount: null })).toBe(true);
    expect(isLikelyRateItem({ quantity: 5, unit: "No", rate: null, amount: null })).toBe(true);
  });

  it("qualifies quantity + rate/amount even without a recognised unit (unusual-but-real unit)", () => {
    expect(isLikelyRateItem({ quantity: 5, unit: null, rate: 10, amount: null })).toBe(true);
    expect(isLikelyRateItem({ quantity: 5, unit: null, rate: null, amount: 50 })).toBe(true);
  });

  it("qualifies a measured unit + price even without an explicit quantity", () => {
    expect(isLikelyRateItem({ quantity: null, unit: "m³", rate: 10, amount: null })).toBe(true);
  });

  it("rejects a row with none of the signals", () => {
    expect(isLikelyRateItem({ quantity: null, unit: null, rate: null, amount: null })).toBe(false);
  });

  it("does NOT qualify quantity=1 + unit 'sum' alone — the JBCC clause-heading boilerplate pattern", () => {
    // Confirmed against a real historical BOQ: every row shaped like
    // "A2  OFFER, ACCEPTANCE AND PERFORMANCE" with unit=Item, quantity=1,
    // no price was a clause heading, not a real unpriced lump-sum item.
    expect(isLikelyRateItem({ quantity: 1, unit: "sum", rate: null, amount: null })).toBe(false);
  });

  it("qualifies unit 'sum' once it's corroborated by an actual price", () => {
    expect(isLikelyRateItem({ quantity: 1, unit: "sum", rate: 500, amount: null })).toBe(true);
    expect(isLikelyRateItem({ quantity: null, unit: "sum", rate: null, amount: 500 })).toBe(true);
  });

  it("treats a literal 0 as absent, not present — the Mjanyana heading / Tyali cross-reference pattern", () => {
    // Real Mjanyana section heading: ["FLOORS AND FLOOR FINISHES", "H2", 0, null, 0]
    expect(isLikelyRateItem({ quantity: 0, unit: null, rate: null, amount: 0 })).toBe(false);
    // Real Tyali cross-reference row: unit "Item" (-> "sum"), quantity 1, amount 0
    expect(isLikelyRateItem({ quantity: 1, unit: "sum", rate: null, amount: 0 })).toBe(false);
    // A zero quantity plus an unrecognised unit still only leaves one
    // corroborating signal (the rate) — still not enough on its own, same
    // "at least two signals" rule as everywhere else.
    expect(isLikelyRateItem({ quantity: 0, unit: null, rate: 50, amount: null })).toBe(false);
    // But a non-zero quantity plus that same rate is two real signals.
    expect(isLikelyRateItem({ quantity: 3, unit: null, rate: 50, amount: null })).toBe(true);
  });
});

describe("classifyNonRateRowType", () => {
  it("recognises bill and section headings", () => {
    expect(classifyNonRateRowType("BILL NO 1")).toBe("bill_heading");
    expect(classifyNonRateRowType("SECTION NO 1")).toBe("section_heading");
  });

  it("recognises a preliminaries heading", () => {
    expect(classifyNonRateRowType("PRELIMINARIES")).toBe("preliminary_general");
  });

  it("recognises JBCC contractual/definitional text", () => {
    expect(classifyNonRateRowType('MEANING OF TERMS "TENDER / TENDERER"')).toBe("contractual_text");
    expect(classifyNonRateRowType("This is a JBCC Principal Building Agreement")).toBe("contractual_text");
  });

  it("recognises subtotal rows", () => {
    expect(classifyNonRateRowType("Sub-total carried forward to Summary")).toBe("subtotal_total");
  });

  it("recognises NOTE:/N.B. and Specification rows alike, even though only NOTE:/N.B. is definitive", () => {
    expect(classifyNonRateRowType("NOTE: rates are to include for all fixing accessories")).toBe(
      "note_specification",
    );
    expect(classifyNonRateRowType("Specification of materials and methods to be used")).toBe("note_specification");
  });

  it("falls back to general_text for unmatched explanatory text", () => {
    expect(classifyNonRateRowType("Some unrelated paragraph of free text")).toBe("general_text");
  });
});
