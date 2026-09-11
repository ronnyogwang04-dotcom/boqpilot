import { describe, expect, it } from "vitest";
import { scoreCandidate, searchRankingConfig } from "./rank-candidate";

describe("scoreCandidate", () => {
  it("returns the raw similarity unchanged when no context hints are provided", () => {
    expect(scoreCandidate(0.8, { normalisedUnit: "m2", category: "Finishes" }, { unitHint: null, category: null })).toBe(
      0.8,
    );
  });

  it("boosts a candidate whose unit matches the hint", () => {
    const score = scoreCandidate(0.7, { normalisedUnit: "m2", category: null }, { unitHint: "m2", category: null });
    expect(score).toBeCloseTo(0.7 + searchRankingConfig.unitMatchBonus);
  });

  it("is case-insensitive when comparing units", () => {
    const score = scoreCandidate(0.7, { normalisedUnit: "M2", category: null }, { unitHint: "m2", category: null });
    expect(score).toBeCloseTo(0.7 + searchRankingConfig.unitMatchBonus);
  });

  it("penalises a candidate whose unit mismatches the hint", () => {
    const score = scoreCandidate(0.7, { normalisedUnit: "no", category: null }, { unitHint: "m2", category: null });
    expect(score).toBeCloseTo(0.7 - searchRankingConfig.unitMismatchPenalty);
  });

  it("boosts a candidate whose category matches the auto-classified query category", () => {
    const score = scoreCandidate(
      0.7,
      { normalisedUnit: null, category: "Electrical" },
      { unitHint: null, category: "Electrical" },
    );
    expect(score).toBeCloseTo(0.7 + searchRankingConfig.categoryMatchBonus);
  });

  it("penalises a candidate whose category mismatches, but less than a unit mismatch would", () => {
    const score = scoreCandidate(
      0.7,
      { normalisedUnit: null, category: "Plumbing & Drainage" },
      { unitHint: null, category: "Electrical" },
    );
    expect(score).toBeCloseTo(0.7 - searchRankingConfig.categoryMismatchPenalty);
    expect(searchRankingConfig.categoryMismatchPenalty).toBeLessThan(searchRankingConfig.unitMismatchPenalty);
  });

  it("combines unit and category adjustments additively", () => {
    const score = scoreCandidate(
      0.6,
      { normalisedUnit: "m2", category: "Finishes" },
      { unitHint: "m2", category: "Finishes" },
    );
    expect(score).toBeCloseTo(0.6 + searchRankingConfig.unitMatchBonus + searchRankingConfig.categoryMatchBonus);
  });

  it("never applies a bonus/penalty for a signal the candidate simply lacks", () => {
    // A candidate with no recorded unit shouldn't be penalised just because
    // the searcher happened to supply a unit hint.
    const score = scoreCandidate(0.7, { normalisedUnit: null, category: null }, { unitHint: "m2", category: "Electrical" });
    expect(score).toBe(0.7);
  });
});
