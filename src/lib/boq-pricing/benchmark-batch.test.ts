import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticSearchResult } from "@/lib/embeddings/semantic-search";

const searchSimilarItemsBatchMock = vi.fn();
vi.mock("@/lib/embeddings/semantic-search-batch", () => ({
  searchSimilarItemsBatch: (...args: unknown[]) => searchSimilarItemsBatchMock(...args),
}));

beforeEach(() => {
  searchSimilarItemsBatchMock.mockReset();
});

function makeMatch(overrides: Partial<SemanticSearchResult> = {}): SemanticSearchResult {
  return {
    id: "1",
    description: "Supply and install distribution board",
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
    ...overrides,
  };
}

describe("getHistoricalBenchmarksBatch", () => {
  it("classifies confidence per item from its own best match", async () => {
    searchSimilarItemsBatchMock.mockResolvedValueOnce(
      new Map([
        ["strong-item", { results: [makeMatch({ similarity: 0.8, sampleCount: 3 })], inferredCategory: "Electrical", inferredUnit: "No" }],
        ["none-item", { results: [], inferredCategory: null, inferredUnit: null }],
      ]),
    );
    const { getHistoricalBenchmarksBatch } = await import("./benchmark-batch");
    const repo = {} as never;

    const result = await getHistoricalBenchmarksBatch(repo, "org-1", [
      { id: "strong-item", description: "supply and install DB", unit: "No" },
      { id: "none-item", description: "nonexistent item", unit: null },
    ]);

    expect(result.get("strong-item")?.confidence).toBe("strong");
    expect(result.get("strong-item")?.bestMatch?.id).toBe("1");
    expect(result.get("none-item")?.confidence).toBe("none");
    expect(result.get("none-item")?.bestMatch).toBeNull();
  });

  it("splits the best match from the rest as evidence, per item", async () => {
    searchSimilarItemsBatchMock.mockResolvedValueOnce(
      new Map([["item-1", { results: [makeMatch({ id: "1" }), makeMatch({ id: "2" }), makeMatch({ id: "3" })], inferredCategory: null, inferredUnit: null }]]),
    );
    const { getHistoricalBenchmarksBatch } = await import("./benchmark-batch");

    const result = await getHistoricalBenchmarksBatch({} as never, "org-1", [{ id: "item-1", description: "x", unit: null }]);

    expect(result.get("item-1")?.bestMatch?.id).toBe("1");
    expect(result.get("item-1")?.evidence.map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("calls the batch search exactly once regardless of item count", async () => {
    searchSimilarItemsBatchMock.mockResolvedValueOnce(new Map());
    const { getHistoricalBenchmarksBatch } = await import("./benchmark-batch");

    await getHistoricalBenchmarksBatch({} as never, "org-1", [
      { id: "a", description: "x", unit: null },
      { id: "b", description: "y", unit: null },
      { id: "c", description: "z", unit: null },
    ]);

    expect(searchSimilarItemsBatchMock).toHaveBeenCalledTimes(1);
  });
});
