import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./cosine-similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it("returns 0 rather than NaN when a vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("throws on mismatched dimensions rather than silently comparing a prefix", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
  });
});
