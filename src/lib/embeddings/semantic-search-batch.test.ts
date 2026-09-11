import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticSearchCandidate, SemanticSearchRepository } from "./semantic-search";
import { searchSimilarItemsBatch } from "./semantic-search-batch";

const createEmbeddingsMock = vi.fn();
const isEmbeddingConfiguredMock = vi.fn(() => true);

vi.mock("./openai-client", () => ({
  createEmbeddings: (...args: unknown[]) => createEmbeddingsMock(...args),
  isEmbeddingConfigured: () => isEmbeddingConfiguredMock(),
}));

function makeCandidate(overrides: Partial<SemanticSearchCandidate> & { id: string; embedding: number[] }): SemanticSearchCandidate {
  return {
    normalisedDescription: "Some canonical item",
    normalisedUnit: "No",
    division: "Building Services",
    category: "Electrical",
    sampleCount: 3,
    projectCount: 2,
    avgRate: 100,
    medianRate: 100,
    minRate: 90,
    maxRate: 110,
    stddevRate: 5,
    mostRecentRate: 105,
    mostRecentRateAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeRepo(candidates: SemanticSearchCandidate[]): SemanticSearchRepository {
  return { async fetchEmbeddedCandidates() { return candidates; } };
}

beforeEach(() => {
  createEmbeddingsMock.mockReset();
  isEmbeddingConfiguredMock.mockReset();
  isEmbeddingConfiguredMock.mockReturnValue(true);
});

describe("searchSimilarItemsBatch", () => {
  it("returns an empty map with no API calls for an empty query list", async () => {
    const result = await searchSimilarItemsBatch(fakeRepo([]), "org-1", []);
    expect(result.size).toBe(0);
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("throws immediately, with no repository/API calls, when OPENAI_API_KEY isn't configured", async () => {
    isEmbeddingConfiguredMock.mockReturnValue(false);
    const repo = fakeRepo([]);
    const fetchSpy = vi.spyOn(repo, "fetchEmbeddedCandidates");

    await expect(searchSimilarItemsBatch(repo, "org-1", [{ id: "a", description: "supply pipe" }])).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("fetches the candidate pool exactly once no matter how many queries are supplied", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([
      [1, 0],
      [0, 1],
      [0.7, 0.7],
    ]);
    const repo = fakeRepo([makeCandidate({ id: "a", embedding: [1, 0] })]);
    const fetchSpy = vi.spyOn(repo, "fetchEmbeddedCandidates");

    await searchSimilarItemsBatch(repo, "org-1", [
      { id: "1", description: "supply distribution board" },
      { id: "2", description: "install pump" },
      { id: "3", description: "remove old fencing" },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("embeds identical description+unit queries only once and applies the result to every matching id", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([makeCandidate({ id: "match", embedding: [1, 0] })]);

    const result = await searchSimilarItemsBatch(repo, "org-1", [
      { id: "1", description: "supply distribution board", unitHint: "No" },
      { id: "2", description: "supply distribution board", unitHint: "No" },
      { id: "3", description: "Supply Distribution Board", unitHint: "No" }, // same after normalisation
    ]);

    expect(createEmbeddingsMock).toHaveBeenCalledTimes(1);
    const [sentTexts] = createEmbeddingsMock.mock.calls[0];
    expect(sentTexts).toHaveLength(1);
    expect(result.get("1")?.results[0].id).toBe("match");
    expect(result.get("2")?.results[0].id).toBe("match");
    expect(result.get("3")?.results[0].id).toBe("match");
  });

  it("returns an empty result with no embedding for a blank-description query, without dropping other queries", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([makeCandidate({ id: "match", embedding: [1, 0] })]);

    const result = await searchSimilarItemsBatch(repo, "org-1", [
      { id: "blank", description: "   " },
      { id: "real", description: "supply distribution board" },
    ]);

    expect(result.get("blank")).toEqual({ results: [], inferredCategory: null, inferredUnit: null });
    expect(result.get("real")?.results[0].id).toBe("match");
    // Only the non-blank query should ever have been embedded.
    const [sentTexts] = createEmbeddingsMock.mock.calls[0];
    expect(sentTexts).toHaveLength(1);
  });

  it("produces the same ranking per query as a single searchSimilarItems call would (shared rankCandidates)", async () => {
    // Two distinct queries, each embedded to point straight at one of two candidates.
    createEmbeddingsMock.mockResolvedValueOnce([
      [1, 0],
      [0, 1],
    ]);
    const repo = fakeRepo([
      makeCandidate({ id: "board", normalisedDescription: "Distribution board", embedding: [1, 0] }),
      makeCandidate({ id: "pump", normalisedDescription: "Submersible pump", embedding: [0, 1] }),
    ]);

    const result = await searchSimilarItemsBatch(repo, "org-1", [
      { id: "q1", description: "distribution board" },
      { id: "q2", description: "submersible pump" },
    ]);

    expect(result.get("q1")?.results[0].id).toBe("board");
    expect(result.get("q2")?.results[0].id).toBe("pump");
  });

  it("splits embedding requests into chunks of embeddingConfig.batchSize", async () => {
    const queries = Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, description: `unique item number ${i}` }));
    createEmbeddingsMock.mockResolvedValueOnce(Array.from({ length: 100 }, () => [1, 0]));
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([makeCandidate({ id: "a", embedding: [1, 0] })]);

    await searchSimilarItemsBatch(repo, "org-1", queries);

    expect(createEmbeddingsMock).toHaveBeenCalledTimes(2);
    expect(createEmbeddingsMock.mock.calls[0][0]).toHaveLength(100);
    expect(createEmbeddingsMock.mock.calls[1][0]).toHaveLength(1);
  });
});
