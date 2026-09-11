// Single source of truth for current-pricing BOQ upload/extraction limits.
// Processing runs synchronously inside the upload Server Action (same "no
// queue worker" convention as the Historical BOQ Library), so these caps
// bound worst-case request time rather than being arbitrary.

export const boqPricingConfig = {
  maxRowsPerFile: 10_000,
  insertBatchSize: 500,

  acceptedExtensions: [".xlsx", ".xls", ".pdf"],
  acceptedMimeTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/pdf",
  ],

  // Excel BOQs don't have "pages" — this converts a row count into the same
  // unit the page-count pricing strategy already understands, so no change
  // is needed to PricingEngine/page-count-strategy.ts itself. Approximate,
  // not a monetisation redesign: a typical printed BOQ page holds roughly
  // this many priced line items.
  excelRowsPerPageEquivalent: 40,

  // PDF extraction: text is chunked into groups of this many pages per AI
  // extraction call, bounding both prompt size and worst-case per-call
  // latency for long tender documents.
  pdfPagesPerExtractionChunk: 4,

  // Structured-output extraction model — cheap and strong at exactly this
  // kind of "turn messy text into typed JSON" task. Separate from
  // embeddingConfig.model (src/config/embeddings.ts), which is an embeddings
  // model and cannot do chat/structured-output completions at all.
  aiExtractionModel: "gpt-4o-mini",
};
