import { describe, expect, it } from "vitest";
import { chunkArray } from "./chunk";

describe("chunkArray", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkArray([], 10)).toEqual([]);
  });

  it("splits evenly when the length is an exact multiple of size", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("puts the remainder in a final, smaller chunk", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one chunk when size exceeds the array length", () => {
    expect(chunkArray([1, 2], 100)).toEqual([[1, 2]]);
  });

  it("throws for a non-positive size", () => {
    expect(() => chunkArray([1], 0)).toThrow();
    expect(() => chunkArray([1], -1)).toThrow();
  });
});
