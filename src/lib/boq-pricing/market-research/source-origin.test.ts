import { describe, expect, it } from "vitest";
import { detectSourceOrigin } from "./source-origin";

function detect(overrides: Partial<Parameters<typeof detectSourceOrigin>[0]> = {}) {
  return detectSourceOrigin({
    sourceDomain: "example.com",
    geographicRelevance: null,
    productDescription: null,
    notes: null,
    ...overrides,
  });
}

describe("detectSourceOrigin", () => {
  it("detects a .co.za domain as South African", () => {
    expect(detect({ sourceDomain: "hinterland.co.za" })).toBe("south_africa");
  });

  it("detects other South African second-level domains (.org.za, .gov.za, .ac.za)", () => {
    expect(detect({ sourceDomain: "example.org.za" })).toBe("south_africa");
    expect(detect({ sourceDomain: "example.gov.za" })).toBe("south_africa");
    expect(detect({ sourceDomain: "example.ac.za" })).toBe("south_africa");
  });

  it("detects a foreign country-code TLD as international", () => {
    expect(detect({ sourceDomain: "savebuild.com.au" })).toBe("international");
    expect(detect({ sourceDomain: "example.co.uk" })).toBe("international");
    expect(detect({ sourceDomain: "sonee.com.mv" })).toBe("international");
  });

  it("does not assume a generic .com domain is foreign — treats it as unknown with no other signal", () => {
    expect(detect({ sourceDomain: "example.com" })).toBe("unknown");
  });

  it("does not assume a .co.za domain is automatically credible — origin is purely geographic, not a quality judgement", () => {
    // detectSourceOrigin only answers "where", never "how trustworthy" — that's evidenceQuality's job.
    expect(detect({ sourceDomain: "some-random-reseller.co.za" })).toBe("south_africa");
  });

  it("treats content explicitly naming a foreign country as international even on a generic TLD", () => {
    expect(detect({ sourceDomain: "example.com", geographicRelevance: "Ships from Australia" })).toBe("international");
    expect(detect({ sourceDomain: "example.com", notes: "Based in the United Kingdom" })).toBe("international");
  });

  it("treats content explicitly naming a South African province as South African on a generic TLD", () => {
    expect(detect({ sourceDomain: "example.com", geographicRelevance: "Gauteng" })).toBe("south_africa");
  });

  it("falls back to unknown when there is no domain or content signal at all", () => {
    expect(detect({ sourceDomain: "example.net" })).toBe("unknown");
  });

  it("real South African retailers from the live validation resolve correctly", () => {
    expect(detect({ sourceDomain: "www.pumps.co.za" })).toBe("south_africa");
    expect(detect({ sourceDomain: "geewiz.co.za" })).toBe("south_africa");
  });
});
