import { describe, expect, it } from "vitest";
import { normaliseDescription } from "./normalise-description";

describe("normaliseDescription", () => {
  it("expands whole-word abbreviations", () => {
    expect(normaliseDescription("reinf conc slab")).toBe("Reinforced concrete slab");
    expect(normaliseDescription("excl vat")).toBe("Excluding vat");
    expect(normaliseDescription("150mm dia pipe")).toBe("150mm diameter pipe");
  });

  it("does not expand abbreviations inside other words", () => {
    expect(normaliseDescription("concrete conclusion")).toBe("Concrete conclusion");
  });

  it("collapses whitespace and strips stray punctuation while keeping dimensions", () => {
    expect(normaliseDescription("  150x300mm   beam!! ")).toBe("150x300mm beam");
    expect(normaliseDescription("50% complete c/w fittings")).toBe("50% complete complete with fittings");
  });

  it("sentence-cases the result", () => {
    expect(normaliseDescription("EXCAVATE TRENCH")).toBe("Excavate trench");
  });

  it("returns an empty string for blank input", () => {
    expect(normaliseDescription("   ")).toBe("");
  });
});
