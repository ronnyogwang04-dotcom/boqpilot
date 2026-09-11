// Single source of truth for the Phase 6 market-research pipeline. Provider
// selection, model, and country defaults live here so getMarketResearchProvider()
// (market-research/provider.ts) is the only place that reads them — nothing
// else hard-codes "openai_web_search" or "South Africa".

export const marketResearchConfig = {
  // The only provider implemented today. Swapping/adding a provider means
  // implementing MarketResearchProvider and extending the switch in
  // market-research/provider.ts — nothing downstream (service, actions, UI,
  // export) references a provider by name.
  activeProvider: "openai_web_search" as const,

  // Responses API model used for the web-search-backed research call.
  // Deliberately separate from boqPricingConfig.aiExtractionModel (chat
  // completions, no web access) and embeddingConfig.model (embeddings only)
  // — a different API surface and a different job.
  webSearchModel: process.env.MARKET_RESEARCH_MODEL || "gpt-4o-mini",

  // Structured-output call that turns a raw BOQ description into a search
  // specification (src/lib/boq-pricing/market-research/search-spec.ts).
  // Cheap chat-completions model, same one PDF/Excel extraction already uses.
  searchSpecModel: "gpt-4o-mini",

  country: "South Africa",
  currency: "ZAR",

  // Cap on how many source citations the provider is asked to return per
  // research run — bounds prompt/response size and keeps evidence review
  // manageable for the estimator, not a claim that more sources don't exist.
  maxSourcesPerRun: 6,

  // Below this many comparable sources, evidence is never aggregated into a
  // range/baseline (spec §8) — a single source is shown as a single source.
  minSourcesForAggregation: 2,

  // A cached research run older than this is treated as stale and a fresh
  // "Refresh Market Research" is recommended, but never auto-triggered
  // (spec §14) — re-running search on every page view is explicitly
  // prohibited (spec §32).
  cacheTtlDays: 30,

  // Coefficient of variation (stddev/mean) across accepted, comparable
  // sources above this is "high market price variation" (spec §18). Same
  // threshold and rationale as export/key-item-flags.ts's historical
  // variance flag, applied here to market evidence instead.
  highVarianceCoefficient: 0.25,

  // Minimum accepted, comparable, verified sources for the aggregate
  // confidence to ever reach "strong" — a single source can be reasonable
  // evidence at best (spec §17).
  strongEvidenceMinSources: 2,
};
