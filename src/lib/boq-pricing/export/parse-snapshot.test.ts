import { describe, expect, it } from "vitest";
import { parseBenchmarkSnapshot, parseCostBuildupComponents, parseCostBuildupMarkups, parseMarketResearchSnapshot } from "./parse-snapshot";

describe("parseCostBuildupComponents", () => {
  it("parses a well-formed snapshot", () => {
    const result = parseCostBuildupComponents({ materialCost: 800, labourCost: 200 });
    expect(result).toEqual({
      materialCost: 800,
      wastagePercent: null,
      labourCost: 200,
      plantCost: null,
      consumablesCost: null,
      transportCost: null,
      subcontractorCost: null,
      otherDirectCost: null,
    });
  });

  it("returns null for null input", () => {
    expect(parseCostBuildupComponents(null)).toBeNull();
  });

  it("returns null for a non-object (malformed/legacy) value instead of throwing", () => {
    expect(parseCostBuildupComponents("not an object" as never)).toBeNull();
    expect(parseCostBuildupComponents(42 as never)).toBeNull();
    expect(parseCostBuildupComponents([1, 2, 3] as never)).toBeNull();
  });

  it("drops non-numeric fields to null rather than passing through garbage", () => {
    const result = parseCostBuildupComponents({ materialCost: "not a number" } as never);
    expect(result?.materialCost).toBeNull();
  });
});

describe("parseCostBuildupMarkups", () => {
  it("parses a well-formed snapshot", () => {
    const result = parseCostBuildupMarkups({ profitPercent: 10 });
    expect(result?.profitPercent).toBe(10);
  });

  it("returns null for null input", () => {
    expect(parseCostBuildupMarkups(null)).toBeNull();
  });
});

describe("parseBenchmarkSnapshot", () => {
  it("parses a well-formed snapshot with a best match", () => {
    const snapshot = {
      confidence: "strong",
      bestMatch: {
        id: "m1",
        description: "Distribution board",
        unit: "No",
        division: "Building Services",
        category: "Electrical",
        similarity: 0.8,
        score: 0.8,
        sampleCount: 3,
        projectCount: 2,
        avgRate: 4500,
        medianRate: 4500,
        minRate: 4000,
        maxRate: 5000,
        stddevRate: 250,
        mostRecentRate: 4800,
        mostRecentRateAt: "2026-01-01T00:00:00Z",
      },
      evidence: [],
      inferredCategory: "Electrical",
      inferredUnit: "No",
    };

    const result = parseBenchmarkSnapshot(snapshot);
    expect(result?.confidence).toBe("strong");
    expect(result?.bestMatch?.avgRate).toBe(4500);
  });

  it("returns null for null input", () => {
    expect(parseBenchmarkSnapshot(null)).toBeNull();
  });

  it("returns null when confidence is missing or invalid, rather than a half-populated object", () => {
    expect(parseBenchmarkSnapshot({ bestMatch: null } as never)).toBeNull();
    expect(parseBenchmarkSnapshot({ confidence: "extremely confident" } as never)).toBeNull();
  });

  it("returns a null bestMatch rather than throwing when bestMatch is missing an id", () => {
    const result = parseBenchmarkSnapshot({ confidence: "none", bestMatch: { description: "no id here" }, evidence: [] } as never);
    expect(result?.bestMatch).toBeNull();
  });

  it("filters out malformed entries from the evidence array instead of throwing", () => {
    const result = parseBenchmarkSnapshot({
      confidence: "weak",
      bestMatch: null,
      evidence: [{ id: "e1" }, "garbage", null, 42],
    } as never);
    expect(result?.evidence).toHaveLength(1);
    expect(result?.evidence[0].id).toBe("e1");
  });

  it("returns null for a non-object (malformed/legacy) value instead of throwing", () => {
    expect(parseBenchmarkSnapshot("garbage" as never)).toBeNull();
  });
});

function marketEvidenceItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    supplierName: "Acme Builders Merchant",
    sourceTitle: "Pipe",
    sourceUrl: "https://acmemerchant.co.za/pipe",
    sourceDomain: "acmemerchant.co.za",
    sourceOrigin: "south_africa",
    productDescription: "110mm pipe",
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
    isManual: false,
    quoteReference: null,
    retrievedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("parseMarketResearchSnapshot", () => {
  it("returns null for null input", () => {
    expect(parseMarketResearchSnapshot(null)).toBeNull();
  });

  it("parses a well-formed snapshot with accepted evidence", () => {
    const snapshot = {
      runStatus: "complete",
      overallConfidence: "strong",
      observedRange: { min: 115, max: 125, unit: "m", sourceCount: 2 },
      representativeBaseline: 120,
      highVariance: false,
      comparabilityNote: null,
      researchedAt: "2026-01-01T00:00:00Z",
      acceptedEvidence: [marketEvidenceItem()],
    };
    const result = parseMarketResearchSnapshot(snapshot);
    expect(result?.overallConfidence).toBe("strong");
    expect(result?.acceptedEvidence).toHaveLength(1);
    expect(result?.acceptedEvidence[0].sourcePrice).toBe(120);
  });

  it("does not drop an evidence item just because it has no published price (sourcePrice null) — regression test for the PRICE_NOT_PUBLISHED round trip", () => {
    const snapshot = {
      overallConfidence: "limited",
      acceptedEvidence: [marketEvidenceItem({ sourcePrice: null, normalisedPrice: null, evidenceQuality: "limited" })],
    };
    const result = parseMarketResearchSnapshot(snapshot);
    expect(result?.acceptedEvidence).toHaveLength(1);
    expect(result?.acceptedEvidence[0].sourcePrice).toBeNull();
  });

  it("defaults an evidence item's sourceOrigin to unknown when missing/invalid rather than throwing", () => {
    const snapshot = {
      overallConfidence: "limited",
      acceptedEvidence: [marketEvidenceItem({ sourceOrigin: "not-a-real-origin" })],
    };
    const result = parseMarketResearchSnapshot(snapshot);
    expect(result?.acceptedEvidence[0].sourceOrigin).toBe("unknown");
  });

  it("carries the comparability note through", () => {
    const snapshot = {
      overallConfidence: "limited",
      comparabilityNote: "3 exact-match sources found but for different specifications.",
      acceptedEvidence: [],
    };
    const result = parseMarketResearchSnapshot(snapshot);
    expect(result?.comparabilityNote).toMatch(/different specifications/i);
  });

  it("returns null when overallConfidence is missing or invalid", () => {
    expect(parseMarketResearchSnapshot({ acceptedEvidence: [] } as never)).toBeNull();
    expect(parseMarketResearchSnapshot({ overallConfidence: "very confident", acceptedEvidence: [] } as never)).toBeNull();
  });

  it("filters out a malformed evidence entry (missing required id) instead of throwing", () => {
    const snapshot = {
      overallConfidence: "limited",
      acceptedEvidence: [marketEvidenceItem(), { garbage: true }, null],
    };
    const result = parseMarketResearchSnapshot(snapshot);
    expect(result?.acceptedEvidence).toHaveLength(1);
  });
});
