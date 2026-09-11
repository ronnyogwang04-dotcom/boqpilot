import { createHash } from "node:crypto";
import { marketResearchConfig } from "@/config/market-research";
import { buildMarketSearchSpecification } from "./search-spec";
import { normaliseEvidence } from "./normalise-evidence";
import { aggregateMarketEvidence, computeMarketEvidenceQuality } from "./confidence";
import type { MarketResearchRepository } from "./repository";
import type { MarketResearchProvider, MarketResearchResult, MarketResearchStatus, MarketSearchSpecification } from "./types";

/** Deterministic cache key: same provider + same structured specification (not the raw BOQ text) hashes identically regardless of call order (spec §14). */
export function hashSearchSpec(spec: MarketSearchSpecification, provider: string): string {
  const stableSpec = JSON.stringify(spec, Object.keys(spec).sort());
  return createHash("sha256").update(`${provider}::${stableSpec}`).digest("hex");
}

export type ResearchOptions = { forceRefresh?: boolean };

/**
 * Orchestrates one line item's market research: build the search
 * specification, check the cache (unless forceRefresh), call the provider,
 * normalise + rate the returned evidence, and persist everything. Never
 * writes to boq_line_items itself — that only happens when the estimator
 * explicitly saves a decision (see actions/market-research.ts), matching
 * the historical-benchmark convention in benchmark.ts.
 */
export async function researchLineItem(
  repo: MarketResearchRepository,
  provider: MarketResearchProvider,
  lineItemId: string,
  requestedBy: string | null,
  options: ResearchOptions = {},
): Promise<MarketResearchResult> {
  const context = await repo.getLineItemContext(lineItemId);
  if (!context) throw new Error("Line item not found.");

  const searchSpec = await buildMarketSearchSpecification({
    description: context.description,
    unit: context.unit,
    category: context.category,
    province: context.province,
    town: context.town,
  });
  const searchSpecHash = hashSearchSpec(searchSpec, provider.name);

  if (!options.forceRefresh) {
    const cacheCutoff = new Date(Date.now() - marketResearchConfig.cacheTtlDays * 24 * 60 * 60 * 1000).toISOString();
    const cached = await repo.findFreshCompletedRun({
      organisationId: context.organisationId,
      lineItemId,
      searchSpecHash,
      provider: provider.name,
      notOlderThanIso: cacheCutoff,
    });
    if (cached) {
      return {
        runId: cached.runId,
        status: cached.status,
        provider: provider.name,
        searchSpec: cached.searchSpec,
        evidence: cached.evidence,
        overallConfidence: cached.overallConfidence,
        observedRange: cached.observedRange,
        representativeBaseline: cached.representativeBaseline,
        highVariance: cached.highVariance,
        comparabilityNote: cached.comparabilityNote,
        usedInternationalFallback: cached.evidence.some((e) => e.sourceOrigin === "international"),
        errorMessage: cached.errorMessage,
        researchedAt: cached.researchedAt,
        cached: true,
      };
    }
  }

  if (!provider.isConfigured()) {
    return {
      runId: "",
      status: "failed",
      provider: provider.name,
      searchSpec,
      evidence: [],
      overallConfidence: "none",
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: null,
      usedInternationalFallback: false,
      errorMessage: "Market research provider is not configured — OPENAI_API_KEY is not set.",
      researchedAt: null,
      cached: false,
    };
  }

  const runId = await repo.createRun({
    organisationId: context.organisationId,
    projectId: context.projectId,
    boqId: context.boqId,
    lineItemId,
    provider: provider.name,
    searchSpec,
    searchSpecHash,
    requestedBy,
  });

  const providerResult = await provider.research(searchSpec).catch((err) => ({
    status: "failed" as const,
    error: err instanceof Error ? err.message : "Market research provider failed.",
  }));

  const researchedAt = new Date().toISOString();

  if (providerResult.status === "failed") {
    await repo.saveRunResult(runId, {
      status: "failed",
      errorMessage: providerResult.error,
      overallConfidence: null,
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: null,
      researchedAt,
    });
    return {
      runId,
      status: "failed",
      provider: provider.name,
      searchSpec,
      evidence: [],
      overallConfidence: "none",
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: null,
      usedInternationalFallback: false,
      errorMessage: providerResult.error,
      researchedAt,
      cached: false,
    };
  }

  if (providerResult.status === "no_result") {
    await repo.saveRunResult(runId, {
      status: "no_result",
      errorMessage: null,
      overallConfidence: "none",
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: null,
      researchedAt,
    });
    return {
      runId,
      status: "no_result",
      provider: provider.name,
      searchSpec,
      evidence: [],
      overallConfidence: "none",
      observedRange: null,
      representativeBaseline: null,
      highVariance: false,
      comparabilityNote: null,
      usedInternationalFallback: false,
      errorMessage: "No reliable current market price found.",
      researchedAt,
      cached: false,
    };
  }

  const citedUrls = new Set(providerResult.citedUrls);
  const normalisedEvidence = providerResult.evidence.map((item) => normaliseEvidence(item, citedUrls));
  const brandSpecific = searchSpec.brand;
  const overallConfidence = computeMarketEvidenceQuality(normalisedEvidence, brandSpecific);
  const { observedRange, representativeBaseline, highVariance, comparabilityNote, usedInternationalFallback } = aggregateMarketEvidence(normalisedEvidence, brandSpecific);
  // Every evidence item was unverified (URL not among the search tool's own
  // citations) — treat as needing estimator review rather than a clean
  // "complete" result, even though the provider technically returned rows.
  const status: MarketResearchStatus = overallConfidence === "none" ? "needs_review" : "complete";

  await repo.insertEvidence(runId, { organisationId: context.organisationId, projectId: context.projectId, lineItemId }, normalisedEvidence, requestedBy);
  await repo.saveRunResult(runId, { status, errorMessage: null, overallConfidence, observedRange, representativeBaseline, highVariance, comparabilityNote, researchedAt });

  return {
    runId,
    status,
    provider: provider.name,
    searchSpec,
    evidence: normalisedEvidence,
    overallConfidence,
    observedRange,
    representativeBaseline,
    highVariance,
    comparabilityNote,
    usedInternationalFallback,
    errorMessage: null,
    researchedAt,
    cached: false,
  };
}

/** Read-only: existing persisted evidence (web-research + manual) for a line item, no new provider call. */
export async function getLineItemMarketEvidence(repo: MarketResearchRepository, lineItemId: string) {
  return repo.getEvidenceForLineItem(lineItemId);
}
