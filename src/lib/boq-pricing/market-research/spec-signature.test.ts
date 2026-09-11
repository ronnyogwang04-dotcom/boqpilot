import { describe, expect, it } from "vitest";
import { buildSpecSignature } from "./spec-signature";

function evidence(overrides: Partial<{ dimensions: string | null; specification: string | null; productDescription: string; brand: string | null }> = {}) {
  return { dimensions: null, specification: null, productDescription: "", brand: null, ...overrides };
}

describe("buildSpecSignature", () => {
  it("gives Y10, Y12, and Y16 reinforcing bar distinct signatures", () => {
    const y10 = buildSpecSignature(evidence({ productDescription: "Y10 Reinforced Round Bar 6.0m 3.702kg" }));
    const y12 = buildSpecSignature(evidence({ productDescription: "STEEL BAR REINFORCING Y12 X 6M" }));
    const y16 = buildSpecSignature(evidence({ productDescription: "REINFORCING YBAR Y16 450MPA 16MM X 6M" }));
    expect(y10).not.toBe(y12);
    expect(y12).not.toBe(y16);
    expect(y10).not.toBe(y16);
  });

  it("treats 'Y10' and a plain '10mm' description as the same diameter", () => {
    const y10 = buildSpecSignature(evidence({ productDescription: "Y10 Reinforced Round Bar 6.0m" }));
    const plainMm = buildSpecSignature(evidence({ productDescription: "STEEL BAR ROUND 10MM X 6M" }));
    expect(y10).toBe(plainMm);
  });

  it("gives 0.75kW and 2.2kW pumps distinct signatures", () => {
    const small = buildSpecSignature(evidence({ productDescription: "DAB S4-3/13 0.75kW Borehole Pump" }));
    const large = buildSpecSignature(evidence({ productDescription: "DAB S4-3/39 2.2kW Borehole Pump" }));
    expect(small).not.toBe(large);
  });

  it("does not mistake a flow rate (litres/second) for a volume capacity", () => {
    const signature = buildSpecSignature(evidence({ productDescription: "Duty point pressure pump with output of 3litres/second at 30m pumping head" }));
    expect(signature).not.toContain("3l");
  });

  it("gives different geyser litre capacities distinct signatures", () => {
    const small = buildSpecSignature(evidence({ dimensions: "100 litre" }));
    const large = buildSpecSignature(evidence({ dimensions: "200 litre" }));
    expect(small).not.toBe(large);
  });

  it("treats '120-litre' and '120L' phrasing as the same capacity", () => {
    const spelled = buildSpecSignature(evidence({ dimensions: "120-litre stainless steel Rocket Donkie Boiler" }));
    const abbreviated = buildSpecSignature(evidence({ dimensions: "120L geyser" }));
    expect(spelled).toBe(abbreviated);
  });

  it("gives the same product from multiple suppliers an identical signature (phrasing differences aside)", () => {
    const supplierA = buildSpecSignature(evidence({ productDescription: "Vaal Sanitaryware Bantam wall-hung cloakroom basin", dimensions: "455 x 290mm" }));
    const supplierB = buildSpecSignature(evidence({ productDescription: "Vaal Bantam Wall Hung Basin 455 X 290MM", dimensions: "455 x 290mm" }));
    expect(supplierA).toBe(supplierB);
  });

  it("distinguishes concrete/steel grade (MPa)", () => {
    const grade25 = buildSpecSignature(evidence({ specification: "25MPa" }));
    const grade30 = buildSpecSignature(evidence({ specification: "30MPa" }));
    expect(grade25).not.toBe(grade30);
  });

  it("falls back to a shared 'unspecified' bucket when no measurable attribute is detected", () => {
    const a = buildSpecSignature(evidence({ productDescription: "Generic face brickwork installation" }));
    const b = buildSpecSignature(evidence({ productDescription: "Another generic brickwork job" }));
    expect(a).toBe("unspecified");
    expect(b).toBe("unspecified");
  });

  it("gives 100 L/min and 500 L/min pumps distinct signatures", () => {
    const small = buildSpecSignature(evidence({ productDescription: "Submersible pump, 100 L/min flow rate" }));
    const large = buildSpecSignature(evidence({ productDescription: "Submersible pump, 500 L/min flow rate" }));
    expect(small).not.toBe(large);
  });

  it("recognises lpm and litres/minute phrasing as the same flow attribute as L/min", () => {
    const a = buildSpecSignature(evidence({ productDescription: "Pump rated 100 L/min" }));
    const b = buildSpecSignature(evidence({ productDescription: "Pump rated 100lpm" }));
    const c = buildSpecSignature(evidence({ productDescription: "Pump rated 100 litres/minute" }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("gives a 2-inch and a 4-inch hose/pump connection distinct signatures", () => {
    const small = buildSpecSignature(evidence({ productDescription: 'Petrol Pump (2" Firehose)' }));
    const large = buildSpecSignature(evidence({ productDescription: "4 inch diesel water pump" }));
    expect(small).not.toBe(large);
  });

  it("gives 10m head and 30m head pumps distinct signatures", () => {
    const low = buildSpecSignature(evidence({ productDescription: "Duty point pressure pump at 10m head" }));
    const high = buildSpecSignature(evidence({ productDescription: "Duty point pressure pump at 30m pumping head" }));
    expect(low).not.toBe(high);
  });

  it("does not confuse a plain metre length elsewhere in the text with pumping head", () => {
    const signature = buildSpecSignature(evidence({ productDescription: "6m cable supplied with pump, no head stated" }));
    expect(signature).not.toMatch(/mhead/);
  });

  it("recognises bar and kPa pressure ratings", () => {
    const bar = buildSpecSignature(evidence({ productDescription: "Pump rated at 8 bar" }));
    const otherBar = buildSpecSignature(evidence({ productDescription: "Pump rated at 5 bar" }));
    const kpa = buildSpecSignature(evidence({ productDescription: "Pump rated at 500 kPa" }));
    expect(bar).not.toBe(otherBar);
    expect(kpa).toContain("kpa");
  });

  it("folds brand into the signature only when the BOQ item was brand-specific", () => {
    const vaal = evidence({ brand: "Vaal" });
    const kohler = evidence({ brand: "Kohler" });
    // Not brand-specific: brand ignored, both fall to the same bucket.
    expect(buildSpecSignature(vaal, null)).toBe(buildSpecSignature(kohler, null));
    // Brand-specific: different evidence brands must diverge.
    expect(buildSpecSignature(vaal, "Vaal")).not.toBe(buildSpecSignature(kohler, "Vaal"));
  });
});
