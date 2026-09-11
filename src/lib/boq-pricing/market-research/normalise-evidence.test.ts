import { describe, expect, it } from "vitest";
import { normaliseEvidence } from "./normalise-evidence";
import type { MarketEvidenceItem } from "./types";

function makeItem(overrides: Partial<MarketEvidenceItem> = {}): MarketEvidenceItem {
  return {
    supplierName: "Acme Builders Merchant",
    sourceTitle: "110mm uPVC Soil Pipe",
    sourceUrl: "https://www.acmemerchant.co.za/products/pipe",
    productDescription: "110mm Class 34 uPVC soil pipe, 6m length",
    manufacturer: "Acme",
    brand: "Acme",
    specification: "Class 34",
    dimensions: "110mm",
    sourcePrice: 720,
    currency: "ZAR",
    vatStatus: "inclusive",
    pricingBasis: "length",
    packQuantity: 6,
    deliveryStatus: null,
    geographicRelevance: "Gauteng",
    evidenceClassification: "material_product_price",
    matchType: "exact",
    sourceDate: null,
    notes: null,
    ...overrides,
  };
}

describe("normaliseEvidence", () => {
  it("converts a per-length price to a per-metre normalised price with the calculation shown", () => {
    const item = makeItem({ pricingBasis: "length", sourcePrice: 720, packQuantity: 6 });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.normalisedUnit).toBe("m");
    expect(result.normalisedPrice).toBeCloseTo(120);
    expect(result.normalisationCalculation).toContain("720.00");
    expect(result.normalisationCalculation).toContain("120.00");
  });

  it("converts a pack price to a per-each normalised price", () => {
    const item = makeItem({ pricingBasis: "pack", sourcePrice: 500, packQuantity: 100 });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.normalisedUnit).toBe("No");
    expect(result.normalisedPrice).toBeCloseTo(5);
  });

  it("does not guess a pack/length quantity that wasn't stated — returns null with an explanation", () => {
    const item = makeItem({ pricingBasis: "length", sourcePrice: 720, packQuantity: null });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.normalisedPrice).toBeNull();
    expect(result.normalisedUnit).toBeNull();
    expect(result.normalisationCalculation).toMatch(/cannot normalise/i);
  });

  it("passes through an already-per-unit price (e.g. 'each') unchanged", () => {
    const item = makeItem({ pricingBasis: "each", sourcePrice: 45, packQuantity: null });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.normalisedUnit).toBe("No");
    expect(result.normalisedPrice).toBe(45);
    expect(result.normalisationCalculation).toBeNull();
  });

  it("carries VAT status through untouched — never converts inclusive/exclusive/unknown", () => {
    for (const vatStatus of ["inclusive", "exclusive", "unknown"] as const) {
      const item = makeItem({ vatStatus, sourcePrice: 100, pricingBasis: "each" });
      const result = normaliseEvidence(item, new Set([item.sourceUrl]));
      expect(result.vatStatus).toBe(vatStatus);
      expect(result.normalisedPrice).toBe(100); // unchanged by VAT status
    }
  });

  it("marks a source as verified when its exact URL is among the web search tool's citations", () => {
    const item = makeItem();
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.verified).toBe(true);
  });

  it("marks a source as verified when its domain (not exact URL) is cited", () => {
    const item = makeItem({ sourceUrl: "https://www.acmemerchant.co.za/products/pipe?ref=123" });
    const result = normaliseEvidence(item, new Set(["https://www.acmemerchant.co.za/catalogue"]));
    expect(result.verified).toBe(true);
  });

  it("marks a source as unverified when neither its URL nor its domain was cited by the search tool — never trusted as reliable evidence", () => {
    const item = makeItem({ sourceUrl: "https://www.some-other-site.co.za/pipe" });
    const result = normaliseEvidence(item, new Set(["https://www.acmemerchant.co.za/catalogue"]));
    expect(result.verified).toBe(false);
    expect(result.evidenceQuality).toBe("unverified");
  });

  it("resolves the source domain from the URL, stripping www.", () => {
    const item = makeItem({ sourceUrl: "https://www.acmemerchant.co.za/products/pipe" });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.sourceDomain).toBe("acmemerchant.co.za");
  });

  it("falls back to 'unknown' domain for an unparsable URL rather than throwing", () => {
    const item = makeItem({ sourceUrl: "not-a-url" });
    const result = normaliseEvidence(item, new Set());
    expect(result.sourceDomain).toBe("unknown");
    expect(result.verified).toBe(false);
  });

  it("rates a verified exact match with a normalised price as strong evidence quality", () => {
    const item = makeItem({ matchType: "exact", pricingBasis: "each", sourcePrice: 50 });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.evidenceQuality).toBe("strong");
  });

  it("rates a verified comparable/substitute match as reasonable, not strong", () => {
    const item = makeItem({ matchType: "comparable", pricingBasis: "each", sourcePrice: 50 });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.evidenceQuality).toBe("reasonable");
  });

  it("carries a non-ZAR currency through without converting it", () => {
    const item = makeItem({ currency: "USD", pricingBasis: "each", sourcePrice: 12 });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.currency).toBe("USD");
    expect(result.normalisedPrice).toBe(12); // no FX conversion applied
  });

  // --- PRICE_NOT_PUBLISHED (never 0 as a placeholder) ---

  it("never fabricates a price for a source with none published — sourcePrice null stays null, never becomes 0", () => {
    const item = makeItem({ sourcePrice: null });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.sourcePrice).toBeNull();
    expect(result.normalisedPrice).toBeNull();
    expect(result.normalisedUnit).toBeNull();
    expect(result.normalisationCalculation).toMatch(/price not published/i);
  });

  it("still retains a no-price source as reference evidence rather than dropping it", () => {
    const item = makeItem({ sourcePrice: null, supplierName: "Some Plant Hire Co" });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.supplierName).toBe("Some Plant Hire Co");
    expect(result.verified).toBe(true);
  });

  // --- Source origin (South African discipline) ---

  it("detects a South African source domain end to end", () => {
    const item = makeItem({ sourceUrl: "https://www.hinterland.co.za/products/steel-bar" });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.sourceOrigin).toBe("south_africa");
  });

  it("detects a foreign source domain end to end", () => {
    const item = makeItem({ sourceUrl: "https://savebuild.com.au/products/rebar" });
    const result = normaliseEvidence(item, new Set([item.sourceUrl]));
    expect(result.sourceOrigin).toBe("international");
  });
});
