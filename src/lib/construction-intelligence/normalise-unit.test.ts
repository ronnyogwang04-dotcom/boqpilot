import { describe, expect, it } from "vitest";
import { normaliseUnit, isKnownUnit, CANONICAL_UNITS } from "./normalise-unit";

describe("normaliseUnit", () => {
  it("collapses recognised spelling variants to one canonical token", () => {
    expect(normaliseUnit("m2")).toBe("m²");
    expect(normaliseUnit("sq.m")).toBe("m²");
    expect(normaliseUnit("SQUARE METRE")).toBe("m²");
    expect(normaliseUnit("m3")).toBe("m³");
    expect(normaliseUnit("cum")).toBe("m³");
    expect(normaliseUnit("nr")).toBe("No");
    expect(normaliseUnit("each")).toBe("No");
    expect(normaliseUnit("lm")).toBe("m");
    expect(normaliseUnit("item")).toBe("sum");
    expect(normaliseUnit("lump sum")).toBe("sum");
    expect(normaliseUnit("Sets")).toBe("Sets");
    expect(normaliseUnit("set")).toBe("Sets");
    expect(normaliseUnit("Pairs")).toBe("Pairs");
    expect(normaliseUnit("pair")).toBe("Pairs");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normaliseUnit("  Sq.M  ")).toBe("m²");
    expect(normaliseUnit("  m2 ")).toBe("m²");
  });

  it("falls back to the trimmed original for an unrecognised unit", () => {
    expect(normaliseUnit("bag")).toBe("bag");
    expect(normaliseUnit("  roll ")).toBe("roll");
  });

  it("returns null for null or blank input", () => {
    expect(normaliseUnit(null)).toBeNull();
    expect(normaliseUnit("   ")).toBeNull();
  });
});

describe("isKnownUnit", () => {
  it("is true for anything normaliseUnit can produce from a recognised spelling", () => {
    for (const unit of CANONICAL_UNITS) {
      expect(isKnownUnit(unit)).toBe(true);
    }
  });

  it("is false for a unit that fell through to the pass-through fallback", () => {
    expect(isKnownUnit("bag")).toBe(false);
    expect(isKnownUnit(null)).toBe(false);
  });
});
