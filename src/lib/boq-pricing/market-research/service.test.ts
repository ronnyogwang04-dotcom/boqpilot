import { describe, expect, it, vi } from "vitest";
import { hashSearchSpec, researchLineItem } from "./service";
import type { CachedRun, LineItemContext, MarketResearchRepository, RunResultUpdate } from "./repository";
import type { MarketEvidenceItem, MarketResearchProvider, MarketResearchProviderResult, MarketSearchSpecification } from "./types";

vi.mock("./search-spec", () => ({
  buildMarketSearchSpecification: vi.fn(async (item: { description: string; unit: string | null }) => ({
    activity: "supply and install",
    primaryMaterial: item.description,
    specification: null,
    dimensions: null,
    application: null,
    ancillaryMaterials: [],
    category: null,
    brand: null,
    standard: null,
    boqUnit: item.unit,
    country: "South Africa",
    province: null,
    town: null,
  })),
}));

const CONTEXT: LineItemContext = {
  organisationId: "org-1",
  projectId: "proj-1",
  boqId: "boq-1",
  description: "110mm uPVC soil pipe",
  unit: "m",
  category: "Plumbing",
  province: "Gauteng",
  town: "Johannesburg",
};

function makeFakeRepo(overrides: Partial<MarketResearchRepository> = {}): MarketResearchRepository & {
  createRunCalls: unknown[];
  saveRunResultCalls: { runId: string; result: RunResultUpdate }[];
  insertEvidenceCalls: unknown[];
} {
  const createRunCalls: unknown[] = [];
  const saveRunResultCalls: { runId: string; result: RunResultUpdate }[] = [];
  const insertEvidenceCalls: unknown[] = [];

  return {
    createRunCalls,
    saveRunResultCalls,
    insertEvidenceCalls,
    async getLineItemContext() {
      return CONTEXT;
    },
    async findFreshCompletedRun() {
      return null;
    },
    async createRun(params) {
      createRunCalls.push(params);
      return "run-1";
    },
    async saveRunResult(runId, result) {
      saveRunResultCalls.push({ runId, result });
    },
    async insertEvidence(runId, context, evidence) {
      insertEvidenceCalls.push({ runId, context, evidence });
    },
    async insertManualEvidence() {},
    async getEvidenceForLineItem() {
      return [];
    },
    async setEvidenceAccepted() {},
    ...overrides,
  };
}

const workingEvidenceItem: MarketEvidenceItem = {
  supplierName: "Acme Builders Merchant",
  sourceTitle: "Pipe",
  sourceUrl: "https://acmemerchant.co.za/pipe",
  productDescription: "110mm Class 34 uPVC pipe",
  manufacturer: null,
  brand: null,
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
};

function makeFakeProvider(research: (spec: MarketSearchSpecification) => Promise<MarketResearchProviderResult>, isConfigured = true): MarketResearchProvider {
  return { name: "fake_provider", isConfigured: () => isConfigured, research };
}

describe("researchLineItem", () => {
  it("returns a cached result without calling the provider when a fresh completed run exists", async () => {
    const cached: CachedRun = {
      runId: "cached-run",
      status: "complete",
      searchSpec: {} as MarketSearchSpecification,
      evidence: [],
      overallConfidence: "strong",
      observedRange: null,
      representativeBaseline: 120,
      highVariance: false,
      comparabilityNote: null,
      errorMessage: null,
      researchedAt: "2026-01-01T00:00:00Z",
    };
    const repo = makeFakeRepo({ findFreshCompletedRun: async () => cached });
    const researchMock = vi.fn();
    const provider = makeFakeProvider(researchMock);

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.cached).toBe(true);
    expect(result.runId).toBe("cached-run");
    expect(researchMock).not.toHaveBeenCalled();
    expect(repo.createRunCalls).toHaveLength(0);
  });

  it("bypasses the cache when forceRefresh is set, even if a fresh run exists", async () => {
    const cached: CachedRun = {
      runId: "cached-run",
      status: "complete",
      searchSpec: {} as MarketSearchSpecification,
      evidence: [],
      overallConfidence: "strong",
      observedRange: null,
      representativeBaseline: 120,
      highVariance: false,
      comparabilityNote: null,
      errorMessage: null,
      researchedAt: "2026-01-01T00:00:00Z",
    };
    const repo = makeFakeRepo({ findFreshCompletedRun: async () => cached });
    const provider = makeFakeProvider(async () => ({ status: "complete", evidence: [workingEvidenceItem], citedUrls: [workingEvidenceItem.sourceUrl] }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1", { forceRefresh: true });

    expect(result.cached).toBe(false);
    expect(repo.createRunCalls).toHaveLength(1);
  });

  it("returns failed without ever calling the provider when it isn't configured", async () => {
    const repo = makeFakeRepo();
    const researchMock = vi.fn();
    const provider = makeFakeProvider(researchMock, false);

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("failed");
    expect(researchMock).not.toHaveBeenCalled();
    expect(repo.createRunCalls).toHaveLength(0);
  });

  it("persists a failed run and returns the provider's error when the provider call fails", async () => {
    const repo = makeFakeRepo();
    const provider = makeFakeProvider(async () => ({ status: "failed", error: "web search timed out" }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("web search timed out");
    expect(repo.saveRunResultCalls).toHaveLength(1);
    expect(repo.saveRunResultCalls[0].result.status).toBe("failed");
    expect(repo.insertEvidenceCalls).toHaveLength(0);
  });

  it("does not throw when the provider promise itself rejects — treats it the same as a failed result", async () => {
    const repo = makeFakeRepo();
    const provider = makeFakeProvider(async () => {
      throw new Error("network error");
    });

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("failed");
  });

  it("returns no_result and records it, without fabricating evidence, when nothing reliable was found", async () => {
    const repo = makeFakeRepo();
    const provider = makeFakeProvider(async () => ({ status: "no_result", reason: "No reliable current market price found." }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("no_result");
    expect(result.evidence).toEqual([]);
    expect(repo.saveRunResultCalls[0].result.status).toBe("no_result");
  });

  it("normalises and persists evidence, computing confidence, on a complete provider result", async () => {
    const repo = makeFakeRepo();
    const provider = makeFakeProvider(async () => ({
      status: "complete",
      evidence: [workingEvidenceItem],
      citedUrls: [workingEvidenceItem.sourceUrl],
    }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("complete");
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].verified).toBe(true);
    expect(result.evidence[0].normalisedPrice).toBe(120);
    expect(repo.insertEvidenceCalls).toHaveLength(1);
    expect(repo.saveRunResultCalls[0].result.status).toBe("complete");
  });

  it("marks the run needs_review rather than complete when all returned evidence turns out unverified", async () => {
    const repo = makeFakeRepo();
    const provider = makeFakeProvider(async () => ({
      status: "complete",
      evidence: [workingEvidenceItem],
      citedUrls: ["https://a-completely-different-domain.example/other"],
    }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.status).toBe("needs_review");
    expect(result.overallConfidence).toBe("none");
  });

  it("detects a .co.za source as South African end to end, and never fabricates a price for a source with none published", async () => {
    const repo = makeFakeRepo();
    const noPriceItem: MarketEvidenceItem = { ...workingEvidenceItem, sourceUrl: "https://someplanthire.co.za/dewatering", sourcePrice: null, evidenceClassification: "supply_only_price", matchType: "unknown" };
    const provider = makeFakeProvider(async () => ({
      status: "complete",
      evidence: [workingEvidenceItem, noPriceItem],
      citedUrls: [workingEvidenceItem.sourceUrl, noPriceItem.sourceUrl],
    }));

    const result = await researchLineItem(repo, provider, "item-1", "user-1");

    expect(result.evidence.find((e) => e.sourceUrl === workingEvidenceItem.sourceUrl)?.sourceOrigin).toBe("south_africa");
    const noPriceResult = result.evidence.find((e) => e.sourceUrl === noPriceItem.sourceUrl);
    expect(noPriceResult?.sourcePrice).toBeNull();
    expect(noPriceResult?.normalisedPrice).toBeNull();
  });
});

describe("hashSearchSpec", () => {
  it("is deterministic for the same specification and provider regardless of key order", () => {
    const spec: MarketSearchSpecification = {
      activity: "supply and install",
      primaryMaterial: "uPVC pipe",
      specification: "Class 34",
      dimensions: "110mm",
      application: null,
      ancillaryMaterials: ["fittings"],
      category: "Plumbing",
      brand: null,
      standard: null,
      boqUnit: "m",
      country: "South Africa",
      province: "Gauteng",
      town: null,
    };
    const hash1 = hashSearchSpec(spec, "openai_web_search");
    const hash2 = hashSearchSpec({ ...spec }, "openai_web_search");
    expect(hash1).toBe(hash2);
  });

  it("produces a different hash for a different provider on the same specification", () => {
    const spec: MarketSearchSpecification = {
      activity: null,
      primaryMaterial: "cement",
      specification: null,
      dimensions: null,
      application: null,
      ancillaryMaterials: [],
      category: null,
      brand: null,
      standard: null,
      boqUnit: null,
      country: "South Africa",
      province: null,
      town: null,
    };
    expect(hashSearchSpec(spec, "provider_a")).not.toBe(hashSearchSpec(spec, "provider_b"));
  });
});
