import { describe, expect, it } from "vitest";
import { computeProjectWorkflowStatus, type ProjectWorkflowInput } from "./status";

const base: ProjectWorkflowInput = {
  hasCurrentBoq: true,
  jobStatus: "COMPLETED",
  isEnterpriseTier: false,
  historicalBoqCount: 0,
  pricingProgress: { totalRateItems: 0, pricedRateItems: 0 },
};

describe("computeProjectWorkflowStatus", () => {
  it("case A: no current BOQ yet", () => {
    const result = computeProjectWorkflowStatus({ ...base, hasCurrentBoq: false, jobStatus: null });
    expect(result.case).toBe("A");
    expect(result.primaryCta.key).toBe("upload");
    expect(result.secondaryCta).toBeNull();
  });

  it("case B: BOQ uploaded, awaiting payment", () => {
    const result = computeProjectWorkflowStatus({ ...base, jobStatus: "WAITING_FOR_PAYMENT" });
    expect(result.case).toBe("B");
    expect(result.primaryCta.key).toBe("pay");
  });

  it("case B_ENTERPRISE: enterprise tier awaiting payment shows contact CTA, not a pay wall", () => {
    const result = computeProjectWorkflowStatus({
      ...base,
      jobStatus: "WAITING_FOR_PAYMENT",
      isEnterpriseTier: true,
    });
    expect(result.case).toBe("B_ENTERPRISE");
    expect(result.primaryCta.key).toBe("enterprise-contact");
  });

  it("case B_PROCESSING: paid, extraction still running", () => {
    const result = computeProjectWorkflowStatus({ ...base, jobStatus: "AI_EXTRACTION" });
    expect(result.case).toBe("B_PROCESSING");
    expect(result.primaryCta.key).toBe("processing");
  });

  it("case B_PROCESSING: extraction failed — still points at the processing page, not a dead end", () => {
    const result = computeProjectWorkflowStatus({ ...base, jobStatus: "FAILED" });
    expect(result.case).toBe("B_PROCESSING");
    expect(result.primaryCta.key).toBe("processing");
  });

  it("case C: extracted, zero historical BOQs, nothing priced yet", () => {
    const result = computeProjectWorkflowStatus({ ...base, historicalBoqCount: 0 });
    expect(result.case).toBe("C");
    expect(result.primaryCta.key).toBe("add-history");
    expect(result.secondaryCta?.key).toBe("price");
  });

  it("case D: extracted, historical library exists, nothing priced yet", () => {
    const result = computeProjectWorkflowStatus({ ...base, historicalBoqCount: 12 });
    expect(result.case).toBe("D");
    expect(result.primaryCta.key).toBe("price");
    expect(result.primaryCta.label).toBe("Price This BOQ");
    expect(result.secondaryCta?.key).toBe("add-history");
  });

  it("case E: partially priced", () => {
    const result = computeProjectWorkflowStatus({
      ...base,
      historicalBoqCount: 12,
      pricingProgress: { totalRateItems: 10, pricedRateItems: 4 },
    });
    expect(result.case).toBe("E");
    expect(result.primaryCta.key).toBe("price");
    expect(result.explanatoryCopy).toMatch(/4 of 10/);
  });

  it("case F: fully priced — export becomes the primary action", () => {
    const result = computeProjectWorkflowStatus({
      ...base,
      historicalBoqCount: 12,
      pricingProgress: { totalRateItems: 10, pricedRateItems: 10 },
    });
    expect(result.case).toBe("F");
    expect(result.primaryCta.key).toBe("export");
  });

  it("never lands on case F for a BOQ with zero rate items", () => {
    const result = computeProjectWorkflowStatus({
      ...base,
      historicalBoqCount: 0,
      pricingProgress: { totalRateItems: 0, pricedRateItems: 0 },
    });
    expect(result.case).not.toBe("F");
  });
});
