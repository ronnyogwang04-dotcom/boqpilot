import { describe, expect, it } from "vitest";
import { parseStoredEmbedding } from "./parse-embedding";

describe("parseStoredEmbedding", () => {
  it("passes an already-parsed array through unchanged", () => {
    expect(parseStoredEmbedding([0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });

  it("parses pgvector's bracket-text wire format", () => {
    expect(parseStoredEmbedding("[-0.042,0.5,1]")).toEqual([-0.042, 0.5, 1]);
  });

  it("returns null for a string that isn't valid JSON", () => {
    expect(parseStoredEmbedding("not json")).toBeNull();
  });

  it("returns null for a JSON string that isn't an array", () => {
    expect(parseStoredEmbedding('{"a":1}')).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseStoredEmbedding(null)).toBeNull();
    expect(parseStoredEmbedding(undefined)).toBeNull();
  });
});
