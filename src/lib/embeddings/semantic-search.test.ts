import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticSearchCandidate, SemanticSearchRepository } from "./semantic-search";
import { searchSimilarItems } from "./semantic-search";

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

describe("searchSimilarItems", () => {
  it("throws immediately, with no repository/API calls, when OPENAI_API_KEY isn't configured", async () => {
    isEmbeddingConfiguredMock.mockReturnValue(false);
    const repo = fakeRepo([]);
    const fetchSpy = vi.spyOn(repo, "fetchEmbeddedCandidates");

    await expect(searchSimilarItems(repo, "org-1", { description: "supply pipe" })).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("returns an empty result with no API call for a blank query", async () => {
    const result = await searchSimilarItems(fakeRepo([]), "org-1", { description: "   " });
    expect(result.results).toEqual([]);
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("ranks candidates by descending combined score", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0, 0]]);
    const repo = fakeRepo([
      makeCandidate({ id: "low", embedding: [0, 1, 0] }),
      makeCandidate({ id: "high", embedding: [1, 0, 0] }),
      makeCandidate({ id: "mid", embedding: [0.7, 0.7, 0] }),
    ]);

    const { results } = await searchSimilarItems(repo, "org-1", { description: "supply distribution board" });

    expect(results.map((r) => r.id)).toEqual(["high", "mid", "low"]);
    expect(results[0].similarity).toBeCloseTo(1);
  });

  it("respects the limit option", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([
      makeCandidate({ id: "a", embedding: [1, 0] }),
      makeCandidate({ id: "b", embedding: [0.9, 0.1] }),
      makeCandidate({ id: "c", embedding: [0.1, 0.9] }),
    ]);

    const { results } = await searchSimilarItems(repo, "org-1", { description: "x" }, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("normalises abbreviations in the query before embedding it (reinf conc -> Reinforced concrete)", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    await searchSimilarItems(fakeRepo([]), "org-1", { description: "reinf conc slab" });

    expect(createEmbeddingsMock).toHaveBeenCalledTimes(1);
    const [sentTexts] = createEmbeddingsMock.mock.calls[0];
    expect(sentTexts[0]).toContain("Reinforced concrete slab");
  });

  it("distinguishes install from remove when their embeddings genuinely differ", async () => {
    // Query embedding represents "install X". The install candidate's
    // vector is close to it; the remove candidate's vector is far — this
    // exercises the ranking pipeline's handling of that distinction (real
    // semantic separability of install/remove is validated separately
    // against live embeddings, per Phase 4 requirement 10).
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0, 0, 0]]);
    const repo = fakeRepo([
      makeCandidate({ id: "install", normalisedDescription: "Install distribution board", embedding: [0.95, 0.05, 0, 0] }),
      makeCandidate({ id: "remove", normalisedDescription: "Remove distribution board", embedding: [0, 0, 1, 0] }),
    ]);

    const { results } = await searchSimilarItems(repo, "org-1", { description: "install distribution board" });

    expect(results[0].id).toBe("install");
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });

  it("lets a unit-hint match promote a slightly-lower-similarity item over a wrong-unit higher-similarity one", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([
      // Higher raw similarity but the wrong unit (m3 supply vs m2 supply are different scopes).
      makeCandidate({ id: "wrong-unit", normalisedUnit: "m³", embedding: [0.99, 0.01] }),
      // Slightly lower raw similarity but the unit the searcher actually asked for.
      makeCandidate({ id: "right-unit", normalisedUnit: "m²", embedding: [0.97, 0.03] }),
    ]);

    const { results } = await searchSimilarItems(repo, "org-1", { description: "supply screed", unitHint: "m2" });

    expect(results[0].id).toBe("right-unit");
  });

  it("still surfaces a strong cross-category match rather than excluding it outright", async () => {
    // Category is a soft boost, not a hard filter — a genuinely similar item
    // from a different category must still appear in results.
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([
      makeCandidate({ id: "cross-category", category: "Plumbing & Drainage", embedding: [0.99, 0.01] }),
    ]);

    const { results } = await searchSimilarItems(repo, "org-1", { description: "supply and install access panel" });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("cross-category");
  });

  it("never calls anything on the repository beyond fetchEmbeddedCandidates (read-only, no merging/altering)", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const repo = fakeRepo([makeCandidate({ id: "a", embedding: [1, 0] })]);
    expect(Object.keys(repo)).toEqual(["fetchEmbeddedCandidates"]);

    await searchSimilarItems(repo, "org-1", { description: "x" });
  });

  it("reports the inferred category/unit used for ranking, for UI transparency", async () => {
    createEmbeddingsMock.mockResolvedValueOnce([[1, 0]]);
    const { inferredUnit, inferredCategory } = await searchSimilarItems(fakeRepo([]), "org-1", {
      description: "supply and install distribution board",
      unitHint: "No",
    });
    expect(inferredUnit).toBe("No");
    expect(inferredCategory).toBe("Electrical");
  });
});
