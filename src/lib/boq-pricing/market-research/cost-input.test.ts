import { describe, expect, it } from "vitest";
import { evidenceToMaterialCostGuidance } from "./cost-input";
import type { NormalisedMarketEvidence } from "./types";

function makeEvidence(overrides: Partial<NormalisedMarketEvidence> = {}): NormalisedMarketEvidence {
  return {
    supplierName: "Acme Builders Merchant",
    sourceTitle: null,
    sourceUrl: "https://www.acmemerchant.co.za/pipe",
    sourceDomain: "acmemerchant.co.za",
    sourceOrigin: "south_africa",
    productDescription: "110mm Class 34 uPVC soil pipe",
    manufacturer: null,
    brand: null,
    specification: null,
    dimensions: null,
    sourcePrice: 120,
    currency: "ZAR",
    vatStatus: "inclusive",
    pricingBasis: "metre",
    packQuantity: null,
    deliveryStatus: null,
    geographicRelevance: null,
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

describe("evidenceToMaterialCostGuidance", () => {
  it("allows a material/product price to feed the cost build-up Material line directly", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ evidenceClassification: "material_product_price" }));
    expect(guidance.usableAsMaterialCost).toBe(true);
    if (guidance.usableAsMaterialCost) {
      expect(guidance.materialCost).toBe(120);
      expect(guidance.unit).toBe("m");
    }
  });

  it("allows a supply-only price to feed the Material line", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ evidenceClassification: "supply_only_price" }));
    expect(guidance.usableAsMaterialCost).toBe(true);
  });

  it("refuses a supply-and-install price — it already bundles labour and must not be used as the material line", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ evidenceClassification: "supply_and_install_price" }));
    expect(guidance.usableAsMaterialCost).toBe(false);
    if (!guidance.usableAsMaterialCost) expect(guidance.reason).toMatch(/labour|install/i);
  });

  it("refuses an installed/service rate — never treats an installed rate as a material cost", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ evidenceClassification: "installed_service_rate" }));
    expect(guidance.usableAsMaterialCost).toBe(false);
  });

  it("refuses evidence that could not be unit-normalised", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ normalisedPrice: null, normalisedUnit: null }));
    expect(guidance.usableAsMaterialCost).toBe(false);
  });

  it("refuses unverified evidence, even if otherwise a material price", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ verified: false }));
    expect(guidance.usableAsMaterialCost).toBe(false);
  });

  it("refuses a source with no published price (PRICE_NOT_PUBLISHED) with a clear, specific reason", () => {
    const guidance = evidenceToMaterialCostGuidance(makeEvidence({ sourcePrice: null, normalisedPrice: null, normalisedUnit: null, normalisationCalculation: "Price not published — supplier quotation required." }));
    expect(guidance.usableAsMaterialCost).toBe(false);
    if (!guidance.usableAsMaterialCost) expect(guidance.reason).toMatch(/price not published/i);
  });
});
