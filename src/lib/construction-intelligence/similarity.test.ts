import { describe, expect, it } from "vitest";
import { describeSimilarity } from "./similarity";

describe("describeSimilarity", () => {
  it("is 1 for identical descriptions", () => {
    expect(describeSimilarity("excavate trench for foundation", "excavate trench for foundation")).toBe(1);
  });

  it("is 0 for completely disjoint descriptions", () => {
    expect(describeSimilarity("excavate trench", "paint interior walls")).toBe(0);
  });

  it("scores a near-duplicate phrasing above the admin review threshold", () => {
    const score = describeSimilarity("excavate trench for foundation", "excavation for foundation trench");
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(1);
  });

  it("treats two empty descriptions as identical and one empty as fully dissimilar", () => {
    expect(describeSimilarity("", "")).toBe(1);
    expect(describeSimilarity("excavate trench", "")).toBe(0);
  });
});
