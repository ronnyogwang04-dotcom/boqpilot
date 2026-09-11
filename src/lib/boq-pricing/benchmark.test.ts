import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticSearchResult } from "@/lib/embeddings/semantic-search";

const searchSimilarItemsMock = vi.fn();
vi.mock("@/lib/embeddings/semantic-search", () => ({
  searchSimilarItems: (...args: unknown[]) => searchSimilarItemsMock(...args),
}));

beforeEach(() => {
  searchSimilarItemsMock.mockReset();
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

describe("getHistoricalBenchmark", () => {
  it("attaches a confidence classification derived from the best match", async () => {
    searchSimilarItemsMock.mockResolvedValueOnce({
      results: [makeMatch({ similarity: 0.8, sampleCount: 3 })],
      inferredCategory: "Electrical",
      inferredUnit: "No",
    });
    const { getHistoricalBenchmark } = await import("./benchmark");
    const repo = {} as never;

    const result = await getHistoricalBenchmark(repo, "org-1", { description: "supply and install DB", unit: "No" });

    expect(result.confidence).toBe("strong");
    expect(result.bestMatch?.id).toBe("1");
    expect(result.inferredCategory).toBe("Electrical");
  });

  it("returns evidence as every match beyond the best one", async () => {
    searchSimilarItemsMock.mockResolvedValueOnce({
      results: [makeMatch({ id: "1" }), makeMatch({ id: "2" }), makeMatch({ id: "3" })],
      inferredCategory: null,
      inferredUnit: null,
    });
    const { getHistoricalBenchmark } = await import("./benchmark");
    const repo = {} as never;

    const result = await getHistoricalBenchmark(repo, "org-1", { description: "x", unit: null });

    expect(result.bestMatch?.id).toBe("1");
    expect(result.evidence.map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("reports 'none' confidence with a null best match when nothing is found", async () => {
    searchSimilarItemsMock.mockResolvedValueOnce({ results: [], inferredCategory: null, inferredUnit: null });
    const { getHistoricalBenchmark } = await import("./benchmark");
    const repo = {} as never;

    const result = await getHistoricalBenchmark(repo, "org-1", { description: "nonexistent item", unit: null });

    expect(result.confidence).toBe("none");
    expect(result.bestMatch).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  it("never calls anything beyond the read-only search — no merging/altering path exists to call", async () => {
    searchSimilarItemsMock.mockResolvedValueOnce({ results: [], inferredCategory: null, inferredUnit: null });
    const { getHistoricalBenchmark } = await import("./benchmark");
    const repo = {} as never;

    await getHistoricalBenchmark(repo, "org-1", { description: "x", unit: null });

    expect(searchSimilarItemsMock).toHaveBeenCalledTimes(1);
  });
});
