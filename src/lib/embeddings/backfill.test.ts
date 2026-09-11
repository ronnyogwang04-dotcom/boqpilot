import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingCandidateRow, EmbeddingRepository, EmbeddingSaveResult } from "./backfill";
import { getEmbeddingWorkload, previewEmbeddingInputs, runEmbeddingBackfill } from "./backfill";

const createEmbeddingsMock = vi.fn();
const isEmbeddingConfiguredMock = vi.fn(() => true);

vi.mock("./openai-client", () => ({
  createEmbeddings: (...args: unknown[]) => createEmbeddingsMock(...args),
  isEmbeddingConfigured: () => isEmbeddingConfiguredMock(),
}));

function makeRow(overrides: Partial<EmbeddingCandidateRow> & { id: string }): EmbeddingCandidateRow {
  return {
    normalisedDescription: "Supply and install distribution board",
    normalisedUnit: "No",
    division: "Building Services",
    category: "Electrical",
    embedding: null,
    embeddingInputText: null,
    embeddingLastError: null,
    mergedIntoId: null,
    sampleCount: 1,
    ...overrides,
  };
}

function createFakeRepository(rows: EmbeddingCandidateRow[]) {
  const store = new Map(rows.map((r) => [r.id, { ...r }]));
  const savedPayloads: { id: string; result: EmbeddingSaveResult }[] = [];

  const repo: EmbeddingRepository = {
    async fetchAllEligible() {
      return [...store.values()];
    },
    async saveEmbeddingResult(id, result) {
      const row = store.get(id);
      if (!row) throw new Error(`no such row: ${id}`);
      row.embedding = result.embedding;
      row.embeddingInputText = result.inputText;
      row.embeddingLastError = result.error;
      savedPayloads.push({ id, result });
    },
  };

  return { repo, store, savedPayloads };
}

const noRetryDelay = { maxRetries: 1, baseDelayMs: 0 };

beforeEach(() => {
  createEmbeddingsMock.mockReset();
  isEmbeddingConfiguredMock.mockReset();
  isEmbeddingConfiguredMock.mockReturnValue(true);
});

describe("getEmbeddingWorkload", () => {
  it("reports eligible/ineligible and status breakdown without ever calling OpenAI", async () => {
    const { repo } = createFakeRepository([
      makeRow({ id: "1" }), // pending
      makeRow({ id: "2", mergedIntoId: "other" }), // ineligible: merged
      makeRow({ id: "3", sampleCount: 0 }), // ineligible: no priced sample
      makeRow({
        id: "4",
        embedding: [0.1],
        embeddingInputText: "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).",
      }), // current
    ]);

    const report = await getEmbeddingWorkload(repo, "org-1");

    expect(report.totalCanonicalItems).toBe(4);
    expect(report.eligible).toBe(2);
    expect(report.ineligible).toBe(2);
    expect(report.byStatus.pending).toBe(1);
    expect(report.byStatus.current).toBe(1);
    expect(report.needsEmbeddingCount).toBe(1);
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });
});

describe("previewEmbeddingInputs", () => {
  it("shows the exact input text without calling OpenAI, skipping already-current items", async () => {
    const { repo } = createFakeRepository([makeRow({ id: "1" })]);
    const previews = await previewEmbeddingInputs(repo, "org-1", 10);

    expect(previews).toHaveLength(1);
    expect(previews[0].inputText).toBe(
      "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).",
    );
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });
});

describe("runEmbeddingBackfill", () => {
  it("throws immediately, with no repository calls, when OPENAI_API_KEY isn't configured", async () => {
    isEmbeddingConfiguredMock.mockReturnValue(false);
    const { repo } = createFakeRepository([makeRow({ id: "1" })]);
    const fetchSpy = vi.spyOn(repo, "fetchAllEligible");

    await expect(runEmbeddingBackfill(repo, "org-1", { limit: 10 })).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("embeds pending items and saves only embedding-related fields, never original description/unit/rates", async () => {
    const { repo, store, savedPayloads } = createFakeRepository([makeRow({ id: "1" })]);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, retry: noRetryDelay });

    expect(summary).toMatchObject({ attempted: 1, succeeded: 1, failed: 0, chunks: 1, apiCalls: 1 });
    expect(store.get("1")?.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(savedPayloads[0].result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      inputText: "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).",
      model: "text-embedding-3-small",
      error: null,
    });
    // Original fields on the candidate row itself were never mutated by the backfill.
    expect(store.get("1")?.normalisedDescription).toBe("Supply and install distribution board");
  });

  it("is idempotent: a second run with nothing changed makes zero API calls", async () => {
    const { repo } = createFakeRepository([makeRow({ id: "1" })]);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);

    await runEmbeddingBackfill(repo, "org-1", { limit: 10, retry: noRetryDelay });
    createEmbeddingsMock.mockClear();

    const secondRun = await runEmbeddingBackfill(repo, "org-1", { limit: 10, retry: noRetryDelay });

    expect(secondRun).toMatchObject({ attempted: 0, succeeded: 0, failed: 0, chunks: 0, apiCalls: 0 });
    expect(createEmbeddingsMock).not.toHaveBeenCalled();
  });

  it("re-embeds only when the input text has drifted (stale), not when it's unchanged", async () => {
    const { repo, store } = createFakeRepository([
      makeRow({
        id: "1",
        embedding: [0.9],
        embeddingInputText: "an old, outdated input text",
      }),
    ]);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1, 0.2]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, retry: noRetryDelay });

    expect(summary.succeeded).toBe(1);
    expect(store.get("1")?.embedding).toEqual([0.1, 0.2]);
  });

  it("batches multiple items into one OpenAI call per chunk, not one call per item", async () => {
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" }), makeRow({ id: "3" })];
    const { repo } = createFakeRepository(rows);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1], [0.2], [0.3]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, batchSize: 10, retry: noRetryDelay });

    expect(summary.apiCalls).toBe(1);
    expect(summary.succeeded).toBe(3);
  });

  it("splits into multiple chunks when the candidate count exceeds batchSize", async () => {
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" }), makeRow({ id: "3" })];
    const { repo } = createFakeRepository(rows);
    createEmbeddingsMock
      .mockResolvedValueOnce([[0.1]])
      .mockResolvedValueOnce([[0.2]])
      .mockResolvedValueOnce([[0.3]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, batchSize: 1, retry: noRetryDelay });

    expect(summary.chunks).toBe(3);
    expect(summary.apiCalls).toBe(3);
    expect(summary.succeeded).toBe(3);
  });

  it("respects the limit option, leaving the rest untouched for a later run", async () => {
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" }), makeRow({ id: "3" })];
    const { repo, store } = createFakeRepository(rows);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 1, retry: noRetryDelay });

    expect(summary.attempted).toBe(1);
    const embeddedCount = [...store.values()].filter((r) => r.embedding !== null).length;
    expect(embeddedCount).toBe(1);
  });

  it("retries a failing chunk and succeeds once the underlying call recovers", async () => {
    const { repo, store } = createFakeRepository([makeRow({ id: "1" })]);
    createEmbeddingsMock.mockRejectedValueOnce(new Error("rate limited")).mockResolvedValueOnce([[0.5]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", {
      limit: 10,
      retry: { maxRetries: 2, baseDelayMs: 0 },
    });

    expect(summary.succeeded).toBe(1);
    expect(store.get("1")?.embedding).toEqual([0.5]);
    expect(createEmbeddingsMock).toHaveBeenCalledTimes(2);
  });

  it("records embedding_last_error and continues to the next chunk after a chunk permanently fails", async () => {
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" })];
    const { repo, store } = createFakeRepository(rows);
    createEmbeddingsMock
      // chunk 1 (item "1"): noRetryDelay allows 1 retry, i.e. 2 total
      // attempts — both must fail for the chunk to be recorded as failed.
      .mockRejectedValueOnce(new Error("permanent failure"))
      .mockRejectedValueOnce(new Error("permanent failure"))
      .mockResolvedValueOnce([[0.7]]); // chunk 2 (item "2") succeeds

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, batchSize: 1, retry: noRetryDelay });

    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(store.get("1")?.embedding).toBeNull();
    expect(store.get("1")?.embeddingLastError).toMatch(/permanent failure/);
    expect(store.get("2")?.embedding).toEqual([0.7]);
  });

  it("does not abort the run when saveEmbeddingResult itself throws (e.g. a transient DB write failure)", async () => {
    // Regression: a real run hit a transient network error on the write-back
    // for one item, which propagated out of runEmbeddingBackfill uncaught
    // and killed the whole process — losing progress on every later chunk
    // even though only one save call actually failed.
    const rows = [makeRow({ id: "1" }), makeRow({ id: "2" }), makeRow({ id: "3" })];
    const { repo, store } = createFakeRepository(rows);
    const realSave = repo.saveEmbeddingResult.bind(repo);
    const saveSpy = vi
      .spyOn(repo, "saveEmbeddingResult")
      .mockImplementationOnce(() => {
        throw new Error("fetch failed");
      })
      .mockImplementation(realSave);
    createEmbeddingsMock
      .mockResolvedValueOnce([[0.1]])
      .mockResolvedValueOnce([[0.2]])
      .mockResolvedValueOnce([[0.3]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, batchSize: 1, retry: noRetryDelay });

    // Item 1's save failed and wasn't counted as succeeded, but the run kept
    // going and items 2 and 3 still made it through.
    expect(summary.succeeded).toBe(2);
    expect(store.get("1")?.embedding).toBeNull();
    expect(store.get("2")?.embedding).toEqual([0.2]);
    expect(store.get("3")?.embedding).toEqual([0.3]);
    saveSpy.mockRestore();
  });

  it("excludes ineligible (merged / zero-sample) items from the run entirely", async () => {
    const rows = [
      makeRow({ id: "1", mergedIntoId: "other" }),
      makeRow({ id: "2", sampleCount: 0 }),
      makeRow({ id: "3" }),
    ];
    const { repo } = createFakeRepository(rows);
    createEmbeddingsMock.mockResolvedValueOnce([[0.1]]);

    const summary = await runEmbeddingBackfill(repo, "org-1", { limit: 10, retry: noRetryDelay });

    expect(summary.attempted).toBe(1);
    expect(createEmbeddingsMock).toHaveBeenCalledWith([
      "Supply and install distribution board. Unit: No. Category: Electrical (Building Services).",
    ]);
  });
});
