import { describe, expect, it, vi } from "vitest";

const extractStructuredRowsMock = vi.fn();

vi.mock("../openai-chat-client", () => ({
  extractStructuredRows: extractStructuredRowsMock,
}));

describe("buildMarketSearchSpecification", () => {
  it("never sends the raw client/project/tender context to the model — only description, unit, and category", async () => {
    extractStructuredRowsMock.mockResolvedValueOnce({
      activity: "supply and install",
      primaryMaterial: "uPVC soil pipe",
      specification: "Class 34",
      dimensions: "110mm diameter",
      application: "soil/drainage",
      ancillaryMaterials: ["fittings"],
      category: "Plumbing & Drainage",
      brand: null,
      standard: null,
    });
    const { buildMarketSearchSpecification } = await import("./search-spec");

    const spec = await buildMarketSearchSpecification({
      description: "Supply and install 110mm diameter Class 34 uPVC soil pipe including fittings",
      unit: "m",
      category: "Plumbing & Drainage",
      province: "Gauteng",
      town: "Johannesburg",
    });

    expect(extractStructuredRowsMock).toHaveBeenCalledTimes(1);
    const call = extractStructuredRowsMock.mock.calls[0][0];
    expect(call.userPrompt).not.toMatch(/client|tender|contractor/i);
    expect(spec.primaryMaterial).toBe("uPVC soil pipe");
    expect(spec.specification).toBe("Class 34");
    expect(spec.boqUnit).toBe("m");
    expect(spec.province).toBe("Gauteng");
    expect(spec.town).toBe("Johannesburg");
    expect(spec.country).toBe("South Africa");
  });

  it("passes through nulls rather than inventing a specification/brand/dimension that wasn't stated", async () => {
    extractStructuredRowsMock.mockResolvedValueOnce({
      activity: null,
      primaryMaterial: "cement",
      specification: null,
      dimensions: null,
      application: null,
      ancillaryMaterials: [],
      category: null,
      brand: null,
      standard: null,
    });
    const { buildMarketSearchSpecification } = await import("./search-spec");

    const spec = await buildMarketSearchSpecification({
      description: "Supply cement",
      unit: null,
      category: null,
      province: null,
      town: null,
    });

    expect(spec.specification).toBeNull();
    expect(spec.brand).toBeNull();
    expect(spec.dimensions).toBeNull();
    expect(spec.ancillaryMaterials).toEqual([]);
  });
});
