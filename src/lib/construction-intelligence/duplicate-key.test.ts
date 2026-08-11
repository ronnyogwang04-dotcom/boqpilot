import { describe, expect, it } from "vitest";
import { buildDuplicateGroupKey, tokenise } from "./duplicate-key";

describe("tokenise", () => {
  it("drops stopwords and keeps original word order", () => {
    expect(tokenise("installation of the cable")).toEqual(["installation", "cable"]);
  });
});

describe("buildDuplicateGroupKey", () => {
  it("produces the same key for reordered phrasing", () => {
    const a = buildDuplicateGroupKey("installation of cable", "m");
    const b = buildDuplicateGroupKey("cable installation", "m");
    expect(a).toBe(b);
  });

  it("keeps the same wording under a different unit separate", () => {
    const a = buildDuplicateGroupKey("supply and fix door", "No");
    const b = buildDuplicateGroupKey("supply and fix door", "m²");
    expect(a).not.toBe(b);
  });

  it("treats a null unit consistently via the '?' placeholder", () => {
    expect(buildDuplicateGroupKey("some item", null)).toBe("?|item some");
  });
});
