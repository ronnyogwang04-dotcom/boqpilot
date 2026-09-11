import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => {
  return {
    // A regular `function` (not an arrow function) so `new OpenAI(...)` in
    // the module under test works — a constructor function that explicitly
    // returns an object makes `new` use that object instead of `this`.
    default: vi.fn().mockImplementation(function OpenAIMock() {
      return { embeddings: { create: createMock } };
    }),
  };
});

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

describe("openai-client", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  describe("isEmbeddingConfigured", () => {
    it("is false when OPENAI_API_KEY is unset", async () => {
      delete process.env.OPENAI_API_KEY;
      const { isEmbeddingConfigured } = await import("./openai-client");
      expect(isEmbeddingConfigured()).toBe(false);
    });

    it("is true when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const { isEmbeddingConfigured } = await import("./openai-client");
      expect(isEmbeddingConfigured()).toBe(true);
    });
  });

  describe("createEmbeddings", () => {
    it("throws without ever calling the API when OPENAI_API_KEY is unset", async () => {
      delete process.env.OPENAI_API_KEY;
      const { createEmbeddings } = await import("./openai-client");
      await expect(createEmbeddings(["a"])).rejects.toThrow(/OPENAI_API_KEY/);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("returns [] and makes no API call for an empty input array", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const { createEmbeddings } = await import("./openai-client");
      const result = await createEmbeddings([]);
      expect(result).toEqual([]);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("makes exactly one API call for a whole batch of texts, not one per text", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      createMock.mockResolvedValueOnce({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] },
        ],
      });
      const { createEmbeddings } = await import("./openai-client");

      const result = await createEmbeddings(["text one", "text two"]);

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ input: ["text one", "text two"], dimensions: 1536 }),
      );
      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    });

    it("returns embeddings in input order even if the API responds out of order", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      createMock.mockResolvedValueOnce({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      });
      const { createEmbeddings } = await import("./openai-client");

      const result = await createEmbeddings(["first", "second"]);
      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    });
  });
});
