import { describe, expect, it } from "vitest";
import { aggregateMarketEvidence, computeMarketEvidenceQuality } from "./confidence";
import type { NormalisedMarketEvidence } from "./types";

function makeEvidence(overrides: Partial<NormalisedMarketEvidence> = {}): NormalisedMarketEvidence {
  return {
    supplierName: "Acme Builders Merchant",
    sourceTitle: "110mm uPVC Soil Pipe",
    sourceUrl: "https://www.acmemerchant.co.za/pipe",
    sourceDomain: "acmemerchant.co.za",
    sourceOrigin: "south_africa",
    productDescription: "110mm Class 34 uPVC soil pipe",
    manufacturer: "Acme",
    brand: "Acme",
    specification: "Class 34",
    dimensions: "110mm",
    sourcePrice: 120,
    currency: "ZAR",
    vatStatus: "inclusive",
    pricingBasis: "metre",
    packQuantity: null,
    deliveryStatus: null,
    geographicRelevance: "Gauteng",
    evidenceClassification: "material_product_price",
    matchType: "exact",
    sourceDate: null,
    notes: null,
    normalisedUnit: "m",
    normalisedPrice: 120,
    normalisationCalculation: null,
    evidenceQuality: "strong",
    verified: true,
    ...overrides,
  };
}

describe("computeMarketEvidenceQuality", () => {
  it("returns none when there is no evidence at all", () => {
    expect(computeMarketEvidenceQuality([])).toBe("none");
  });

  it("returns none when every source is unverified", () => {
    const evidence = [makeEvidence({ verified: false }), makeEvidence({ verified: false })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("none");
  });

  it("returns strong with 2+ same-specification exact matches and VAT known for all of them", () => {
    const evidence = [
      makeEvidence({ matchType: "exact", vatStatus: "inclusive" }),
      makeEvidence({ matchType: "exact", vatStatus: "exclusive" }),
    ];
    expect(computeMarketEvidenceQuality(evidence)).toBe("strong");
  });

  it("does not return strong when VAT status is unknown for any usable source", () => {
    const evidence = [makeEvidence({ matchType: "exact", vatStatus: "inclusive" }), makeEvidence({ matchType: "exact", vatStatus: "unknown" })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });

  it("does not return strong for two exact matches of DIFFERENT specifications, even with VAT known for both", () => {
    // Y10 vs Y16 reinforcing bar — both "exact" individually, but not comparable to each other.
    const evidence = [
      makeEvidence({ matchType: "exact", dimensions: "10mm", vatStatus: "inclusive" }),
      makeEvidence({ matchType: "exact", dimensions: "16mm", vatStatus: "inclusive" }),
    ];
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });

  it("returns reasonable for a single exact-match verified source", () => {
    const evidence = [makeEvidence({ matchType: "exact" })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });

  it("returns limited for a single comparable/substitute source only", () => {
    const evidence = [makeEvidence({ matchType: "comparable" })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("limited");
  });

  it("returns limited even for multiple comparable/substitute sources — substitutes never reach reasonable/strong on their own", () => {
    const evidence = [makeEvidence({ matchType: "comparable" }), makeEvidence({ matchType: "comparable" })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("limited");
  });

  it("ignores unverified sources when deciding quality, even if other sources are strong", () => {
    const evidence = [makeEvidence({ matchType: "exact" }), makeEvidence({ verified: false, sourcePrice: 99999 })];
    // Same as the single-verified-exact-match case — the unverified outlier must not affect the result.
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });

  it("does not let a source with no published price count towards quality", () => {
    const evidence = [makeEvidence({ matchType: "exact" }), makeEvidence({ sourcePrice: null, normalisedPrice: null, matchType: "exact" })];
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });
});

describe("aggregateMarketEvidence", () => {
  it("does not compute a range/baseline below the minimum comparable-source count", () => {
    const evidence = [makeEvidence({ normalisedPrice: 120 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBe(120); // still shown as a lone source, not silently treated as "the market rate"
    expect(result.highVariance).toBe(false);
    expect(result.comparabilityNote).toBeNull();
  });

  it("aggregates a comparable group of sources into a range and median baseline", () => {
    const evidence = [makeEvidence({ normalisedPrice: 115 }), makeEvidence({ normalisedPrice: 123 }), makeEvidence({ normalisedPrice: 121 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 115, max: 123, unit: "m", sourceCount: 3 });
    expect(result.representativeBaseline).toBe(121);
  });

  it("never combines different units into one range", () => {
    const evidence = [makeEvidence({ normalisedUnit: "m", normalisedPrice: 120 }), makeEvidence({ normalisedUnit: "No", normalisedPrice: 45 })];
    const result = aggregateMarketEvidence(evidence);
    // Neither group reaches the minimum size on its own, and they're fragmented (2 exact matches, no shared group).
    expect(result.observedRange).toBeNull();
    expect(result.comparabilityNote).toMatch(/different specifications/i);
  });

  it("never combines different evidence classifications (e.g. material price vs installed rate) into one range", () => {
    const evidence = [
      makeEvidence({ evidenceClassification: "material_product_price", normalisedPrice: 120 }),
      makeEvidence({ evidenceClassification: "supply_and_install_price", normalisedPrice: 250 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("flags high variance when the spread across comparable sources is wide", () => {
    const evidence = [makeEvidence({ normalisedPrice: 100 }), makeEvidence({ normalisedPrice: 180 }), makeEvidence({ normalisedPrice: 260 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.highVariance).toBe(true);
  });

  it("does not flag variance for a tight comparable price spread", () => {
    const evidence = [makeEvidence({ normalisedPrice: 118 }), makeEvidence({ normalisedPrice: 120 }), makeEvidence({ normalisedPrice: 122 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.highVariance).toBe(false);
  });

  it("excludes evidence in a currency other than the market currency from aggregation", () => {
    const evidence = [makeEvidence({ currency: "ZAR", normalisedPrice: 120 }), makeEvidence({ currency: "USD", normalisedPrice: 8 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull(); // only one ZAR source — below the minimum
    expect(result.representativeBaseline).toBe(120);
  });

  // --- Spec/SKU comparability (different diameters/capacities/grades) ---

  it("does not blend reinforcing bars of different diameters (Y10 vs Y12 vs Y16) into one average", () => {
    const evidence = [
      makeEvidence({ dimensions: "10mm", normalisedPrice: 74.9 }),
      makeEvidence({ dimensions: "12mm", normalisedPrice: 109.69 }),
      makeEvidence({ dimensions: "16mm", normalisedPrice: 208.99 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBeNull();
    expect(result.comparabilityNote).toMatch(/different specifications/i);
  });

  it("aggregates two sources of the SAME diameter even when other diameters are also present", () => {
    const evidence = [
      makeEvidence({ dimensions: "Y10", normalisedPrice: 76.95 }),
      makeEvidence({ dimensions: "10mm", normalisedPrice: 74.9 }), // same diameter, phrased differently — must still group
      makeEvidence({ dimensions: "Y16", normalisedPrice: 208.99 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 74.9, max: 76.95, unit: "m", sourceCount: 2 });
  });

  it("does not blend pumps of different power ratings (0.75kW vs 2.2kW)", () => {
    const evidence = [makeEvidence({ productDescription: "0.75kW borehole pump", normalisedPrice: 2249 }), makeEvidence({ productDescription: "2.2kW borehole pump", normalisedPrice: 6165 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("does not blend geysers of different litre capacities", () => {
    const evidence = [makeEvidence({ dimensions: "100 litre", normalisedPrice: 8500 }), makeEvidence({ dimensions: "200 litre", normalisedPrice: 15000 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("never folds comparable/substitute evidence into the exact baseline, and says so when only substitutes exist", () => {
    const evidence = [makeEvidence({ matchType: "comparable", normalisedPrice: 999 }), makeEvidence({ matchType: "comparable", normalisedPrice: 50 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBeNull();
    expect(result.comparabilityNote).toMatch(/insufficient exact/i);
  });

  it("keeps a comparable substitute from dragging the exact-match baseline even when both exist", () => {
    const evidence = [makeEvidence({ matchType: "exact", normalisedPrice: 120 }), makeEvidence({ matchType: "comparable", normalisedPrice: 5 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.representativeBaseline).toBe(120); // the lone exact match, never blended with the R5 substitute
  });

  it("groups an exact brand-specific match separately from a same-spec different-brand result when the BOQ specified a brand", () => {
    const evidence = [
      makeEvidence({ matchType: "exact", brand: "Vaal", normalisedPrice: 329 }),
      makeEvidence({ matchType: "exact", brand: "Kohler", normalisedPrice: 550 }),
    ];
    const result = aggregateMarketEvidence(evidence, "Vaal");
    expect(result.observedRange).toBeNull(); // fragmented into two single-brand groups
    expect(result.comparabilityNote).toMatch(/different specifications/i);
  });

  it("ignores brand for grouping when the BOQ item was not brand-specific", () => {
    const evidence = [
      makeEvidence({ matchType: "exact", brand: "Vaal", normalisedPrice: 329 }),
      makeEvidence({ matchType: "exact", brand: "Kohler", normalisedPrice: 331 }),
    ];
    const result = aggregateMarketEvidence(evidence, null);
    expect(result.observedRange).toEqual({ min: 329, max: 331, unit: "m", sourceCount: 2 });
  });

  it("aggregates same specification at different pack sizes once correctly unit-normalised", () => {
    // One source: R720 for a 6m length; another: R125/m directly. Both should normalise to per-metre and group.
    const evidence = [
      makeEvidence({ pricingBasis: "length", sourcePrice: 720, packQuantity: 6, normalisedPrice: 120, normalisedUnit: "m" }),
      makeEvidence({ pricingBasis: "metre", sourcePrice: 125, packQuantity: null, normalisedPrice: 125, normalisedUnit: "m" }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 120, max: 125, unit: "m", sourceCount: 2 });
  });

  // --- South African source discipline ---

  it("uses South African sources as the default comparable set, excluding international ones by default", () => {
    const evidence = [
      makeEvidence({ sourceOrigin: "south_africa", normalisedPrice: 120 }),
      makeEvidence({ sourceOrigin: "south_africa", normalisedPrice: 124 }),
      makeEvidence({ sourceOrigin: "international", normalisedPrice: 5000 }), // wildly different — must not pollute the SA baseline
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 120, max: 124, unit: "m", sourceCount: 2 });
    expect(result.usedInternationalFallback).toBe(false);
  });

  it("falls back to international evidence only when there is no South-African-or-unknown-origin evidence at all", () => {
    const evidence = [makeEvidence({ sourceOrigin: "international", normalisedPrice: 120 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.representativeBaseline).toBe(120);
    expect(result.usedInternationalFallback).toBe(true);
  });

  it("treats unknown-origin evidence as part of the default comparable set (not excluded like international)", () => {
    const evidence = [makeEvidence({ sourceOrigin: "unknown", normalisedPrice: 120 }), makeEvidence({ sourceOrigin: "unknown", normalisedPrice: 124 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 120, max: 124, unit: "m", sourceCount: 2 });
    expect(result.usedInternationalFallback).toBe(false);
  });

  // --- Pump/equipment attributes (flow rate, connection size, head) + fail-closed rule ---

  it("does not blend pumps of different flow rates (100 L/min vs 500 L/min)", () => {
    const evidence = [
      makeEvidence({ productDescription: "Submersible pump, 100 L/min flow rate", normalisedPrice: 2000 }),
      makeEvidence({ productDescription: "Submersible pump, 500 L/min flow rate", normalisedPrice: 8000 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("does not blend a 2-inch and a 4-inch pump/hose connection", () => {
    const evidence = [
      makeEvidence({ productDescription: 'Petrol water pump (2" hose)', normalisedPrice: 820 }),
      makeEvidence({ productDescription: "Diesel water pump (4 inch hose)", normalisedPrice: 5300 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("does not blend a 10m head and a 30m head pump", () => {
    const evidence = [
      makeEvidence({ productDescription: "Duty point pressure pump at 10m head", normalisedPrice: 2200 }),
      makeEvidence({ productDescription: "Duty point pressure pump at 30m pumping head", normalisedPrice: 12000 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
  });

  it("CAN aggregate multiple identical-spec pumps from different suppliers", () => {
    const evidence = [
      makeEvidence({ supplierName: "Pumps.co.za", productDescription: "Borehole pump, 2.2kW, 30m head", normalisedPrice: 6165 }),
      makeEvidence({ supplierName: "Pumps and Filters", productDescription: "Borehole pump 2.2kW 30m head", normalisedPrice: 6690 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 6165, max: 6690, unit: "m", sourceCount: 2 });
    expect(result.comparabilityNote).toBeNull();
  });

  it("FAILS CLOSED — the real Gravitron case: multiple materially different, unrecognised equipment variants must NOT be averaged just because none share a detected attribute", () => {
    // Mist rig, fire pump, filtration pump — no diameter/kW/flow/head pattern present in any of them.
    const evidence = [
      makeEvidence({ supplierName: "Gravitron", productDescription: "Mist Rig (100 nozzles, High-pressure system)", specification: null, dimensions: null, normalisedPrice: 3950 }),
      makeEvidence({ supplierName: "Gravitron", productDescription: "Angus Fire Pump", specification: null, dimensions: null, normalisedPrice: 5300 }),
      makeEvidence({ supplierName: "Gravitron", productDescription: "Godiva Pump", specification: null, dimensions: null, normalisedPrice: 4500 }),
      makeEvidence({ supplierName: "Gravitron", productDescription: "Filtration/Submersible Pump", specification: null, dimensions: null, normalisedPrice: 210 }),
      makeEvidence({ supplierName: "Gravitron", productDescription: "Wellpoint Electrical Pump", specification: null, dimensions: null, normalisedPrice: 290 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBeNull();
    expect(result.highVariance).toBe(false);
    expect(result.comparabilityNote).toMatch(/differ in specification.*could not be confirmed as technically comparable/i);
  });

  it("fails closed when ALL items are 'unspecified' but materially different — never averages purely because they share the fallback bucket", () => {
    const evidence = [
      makeEvidence({ productDescription: "Generic face brickwork installation", specification: null, dimensions: null, normalisedPrice: 300 }),
      makeEvidence({ productDescription: "Structural steel connector bracket", specification: null, dimensions: null, normalisedPrice: 9000 }),
      makeEvidence({ productDescription: "Site clearance and grubbing", specification: null, dimensions: null, normalisedPrice: 55 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBeNull();
    expect(result.comparabilityNote).toMatch(/could not be confirmed as technically comparable/i);
  });

  it("still aggregates 'unspecified' evidence when every item's own description is effectively identical (genuinely the same unrecognised product from different suppliers)", () => {
    const evidence = [
      makeEvidence({ supplierName: "Supplier A", productDescription: "Generic face brickwork installation", specification: null, dimensions: null, normalisedPrice: 300 }),
      makeEvidence({ supplierName: "Supplier B", productDescription: "Generic face brickwork installation", specification: null, dimensions: null, normalisedPrice: 320 }),
    ];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toEqual({ min: 300, max: 320, unit: "m", sourceCount: 2 });
    expect(result.comparabilityNote).toBeNull();
  });

  it("a single valid priced source is shown as a lone baseline (limited evidence), never falsely aggregated with itself", () => {
    const evidence = [makeEvidence({ productDescription: "One-off specialist item", normalisedPrice: 4500 })];
    const result = aggregateMarketEvidence(evidence);
    expect(result.observedRange).toBeNull();
    expect(result.representativeBaseline).toBe(4500);
    expect(result.comparabilityNote).toBeNull();
    expect(computeMarketEvidenceQuality(evidence)).toBe("reasonable");
  });
});
