import { describe, expect, it } from "vitest";
import { isLikelyKeyMaterial, recommendMarketResearch } from "./policy";

describe("recommendMarketResearch", () => {
  it("recommends research when there is no historical benchmark at all", () => {
    const result = recommendMarketResearch("none", "Supply and install a 50mm PVC pipe");
    expect(result.recommended).toBe(true);
  });

  it("recommends research as a cross-check for a weak historical match", () => {
    const result = recommendMarketResearch("weak", "Supply and install a 50mm PVC pipe");
    expect(result.recommended).toBe(true);
  });

  it("does not recommend research for a strong historical match on an ordinary item", () => {
    const result = recommendMarketResearch("strong", "Supply and install a 50mm PVC pipe");
    expect(result.recommended).toBe(false);
  });

  it("still recommends research for a strong historical match when the item is a likely key/high-risk material", () => {
    const result = recommendMarketResearch("strong", "Supply and install a diesel generator, 250kVA");
    expect(result.recommended).toBe(true);
  });

  it("treats a reasonable historical match as optional cross-check, not mandatory, for an ordinary item", () => {
    const result = recommendMarketResearch("reasonable", "Supply and install a 50mm PVC pipe");
    expect(result.recommended).toBe(false);
  });
});

describe("isLikelyKeyMaterial", () => {
  it("flags a generator as a key material", () => {
    expect(isLikelyKeyMaterial("Supply and install standby diesel generator")).toBe(true);
  });

  it("flags a distribution board as a key material", () => {
    expect(isLikelyKeyMaterial("Supply and install 3-phase distribution board")).toBe(true);
  });

  it("does not flag an ordinary, unremarkable item", () => {
    expect(isLikelyKeyMaterial("Supply and lay 25MPa concrete in slab")).toBe(false);
  });
});
