import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const responsesCreateMock = vi.fn();
const extractStructuredRowsMock = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function OpenAIMock() {
    return { responses: { create: responsesCreateMock } };
  }),
}));

vi.mock("../../openai-chat-client", () => ({
  extractStructuredRows: extractStructuredRowsMock,
}));

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

const baseSpec = {
  activity: "supply and install",
  primaryMaterial: "uPVC soil pipe",
  specification: "Class 34",
  dimensions: "110mm diameter",
  application: "soil/drainage",
  ancillaryMaterials: ["fittings"],
  category: "Plumbing & Drainage",
  brand: null,
  standard: null,
  boqUnit: "m",
  country: "South Africa",
  province: "Gauteng",
  town: "Johannesburg",
};

function makeSearchResponse(citedUrls: { url: string; title: string }[], outputText = "Found some pricing.") {
  return {
    output_text: outputText,
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: outputText,
            annotations: citedUrls.map((c) => ({ type: "url_citation", url: c.url, title: c.title, start_index: 0, end_index: 1 })),
          },
        ],
      },
    ],
  };
}

describe("openAiWebSearchProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    responsesCreateMock.mockReset();
    extractStructuredRowsMock.mockReset();
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it("isConfigured is false without an API key, true with one", async () => {
    delete process.env.OPENAI_API_KEY;
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");
    expect(openAiWebSearchProvider.isConfigured()).toBe(false);

    process.env.OPENAI_API_KEY = "sk-test-key";
    const { openAiWebSearchProvider: reloaded } = await import("./openai-web-search-provider");
    expect(reloaded.isConfigured()).toBe(true);
  });

  it("returns no_result when the web search produced no citations", async () => {
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([]));
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("no_result");
    expect(extractStructuredRowsMock).not.toHaveBeenCalled();
  });

  it("returns failed when the web search API call throws", async () => {
    responsesCreateMock.mockRejectedValueOnce(new Error("upstream timeout"));
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toMatch(/timeout/);
  });

  it("returns failed when the structured extraction step throws", async () => {
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([{ url: "https://acmemerchant.co.za/pipe", title: "Pipe" }]));
    extractStructuredRowsMock.mockRejectedValueOnce(new Error("bad JSON"));
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("failed");
  });

  it("returns no_result when the extraction reports noReliablePriceFound", async () => {
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([{ url: "https://acmemerchant.co.za/pipe", title: "Pipe" }]));
    extractStructuredRowsMock.mockResolvedValueOnce({ noReliablePriceFound: true, evidence: [] });
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("no_result");
  });

  it("drops any evidence item whose URL is not among the actual web-search citations, even if the extraction step returns it", async () => {
    const citedUrl = "https://acmemerchant.co.za/pipe";
    const fabricatedUrl = "https://not-a-real-cited-source.example/pipe";
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([{ url: citedUrl, title: "Pipe" }]));
    extractStructuredRowsMock.mockResolvedValueOnce({
      noReliablePriceFound: false,
      evidence: [
        { supplierName: "Acme", sourceTitle: "Pipe", sourceUrl: citedUrl, productDescription: "110mm pipe", manufacturer: null, brand: null, specification: null, dimensions: null, sourcePrice: 120, currency: "ZAR", vatStatus: "inclusive", pricingBasis: "metre", packQuantity: null, deliveryStatus: null, geographicRelevance: null, evidenceClassification: "material_product_price", matchType: "exact", sourceDate: null, notes: null },
        { supplierName: "Fake Supplier", sourceTitle: "Fake", sourceUrl: fabricatedUrl, productDescription: "110mm pipe", manufacturer: null, brand: null, specification: null, dimensions: null, sourcePrice: 10, currency: "ZAR", vatStatus: "unknown", pricingBasis: "metre", packQuantity: null, deliveryStatus: null, geographicRelevance: null, evidenceClassification: "material_product_price", matchType: "exact", sourceDate: null, notes: null },
      ],
    });
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.evidence).toHaveLength(1);
      expect(result.evidence[0].sourceUrl).toBe(citedUrl);
      expect(result.citedUrls).toContain(citedUrl);
    }
  });

  it("returns no_result when every extracted evidence item is filtered out as uncited", async () => {
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([{ url: "https://acmemerchant.co.za/pipe", title: "Pipe" }]));
    extractStructuredRowsMock.mockResolvedValueOnce({
      noReliablePriceFound: false,
      evidence: [
        { supplierName: "Fake", sourceTitle: "Fake", sourceUrl: "https://invented.example/pipe", productDescription: "pipe", manufacturer: null, brand: null, specification: null, dimensions: null, sourcePrice: 10, currency: "ZAR", vatStatus: "unknown", pricingBasis: "metre", packQuantity: null, deliveryStatus: null, geographicRelevance: null, evidenceClassification: "material_product_price", matchType: "exact", sourceDate: null, notes: null },
      ],
    });
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("no_result");
  });

  it("passes a null sourcePrice straight through as evidence (a source can be cited/useful with no published price) — status stays complete, never no_result just because of a missing price", async () => {
    const citedUrl = "https://someplanthire.co.za/dewatering";
    responsesCreateMock.mockResolvedValueOnce(makeSearchResponse([{ url: citedUrl, title: "Dewatering pump hire" }]));
    extractStructuredRowsMock.mockResolvedValueOnce({
      noReliablePriceFound: false,
      evidence: [
        { supplierName: "Some Plant Hire", sourceTitle: "Dewatering pump hire", sourceUrl: citedUrl, productDescription: "Dewatering pump hire, various capacities", manufacturer: null, brand: null, specification: null, dimensions: null, sourcePrice: null, currency: "ZAR", vatStatus: "unknown", pricingBasis: "other", packQuantity: null, deliveryStatus: null, geographicRelevance: null, evidenceClassification: "equipment_hire_rate", matchType: "unknown", sourceDate: null, notes: null },
      ],
    });
    const { openAiWebSearchProvider } = await import("./openai-web-search-provider");

    const result = await openAiWebSearchProvider.research(baseSpec);

    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.evidence[0].sourcePrice).toBeNull();
    }
  });
});
