// Single source of truth for the Historical Library's embedding pipeline
// (Phase 3 — see src/lib/embeddings/). Backfills run synchronously inside a
// Server Action, same as historical-boq.ts's insertBatchSize, so batchSize
// bounds worst-case request time as much as it bounds OpenAI request count.

export const embeddingConfig = {
  // text-embedding-3-small is natively 1536-dimensional — matches
  // rate_library_items.embedding's existing `vector(1536)` column exactly,
  // no truncation needed. Also the cheapest current OpenAI embedding model,
  // appropriate for retrieval/similarity at this dataset's scale.
  model: "text-embedding-3-small",
  dimensions: 1536,

  // Canonical items embedded per OpenAI API call (one call embeds the
  // whole chunk, not one call per item).
  batchSize: 100,

  maxRetries: 3,
  retryBaseDelayMs: 500,

  // Rough token estimate for dry-run cost reporting only — not used for
  // anything that affects correctness. ~4 characters per token is OpenAI's
  // own commonly-cited approximation for English text.
  approxCharsPerToken: 4,
};
