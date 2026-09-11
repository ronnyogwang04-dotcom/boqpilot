// Core domain types for Phase 6 market research. Every type here is either
// what a provider returns (raw, unverified), what normalisation/confidence
// derive from it (still evidence, never a decision), or what gets persisted
// — never a "final price". The estimator's own saved decision lives on
// boq_line_items (rate_source = 'online', market_research_snapshot), same
// convention as the historical-benchmark snapshot.

/** What a BOQ line item is converted into before any web search happens (spec §4). Never includes client/tender/contractor identity. */
export type MarketSearchSpecification = {
  activity: string | null;
  primaryMaterial: string;
  specification: string | null;
  dimensions: string | null;
  application: string | null;
  ancillaryMaterials: string[];
  category: string | null;
  brand: string | null;
  standard: string | null;
  boqUnit: string | null;
  country: string;
  province: string | null;
  town: string | null;
};

export type MarketEvidenceClassification =
  | "material_product_price"
  | "supply_only_price"
  | "supply_and_install_price"
  | "installed_service_rate"
  | "equipment_hire_rate"
  | "subcontractor_specialist_price"
  | "other"
  | "unknown";

export const MARKET_EVIDENCE_CLASSIFICATION_LABELS: Record<MarketEvidenceClassification, string> = {
  material_product_price: "Material / product price",
  supply_only_price: "Supply-only price",
  supply_and_install_price: "Supply-and-install price",
  installed_service_rate: "Installed / service rate",
  equipment_hire_rate: "Equipment hire rate",
  subcontractor_specialist_price: "Subcontractor / specialist price",
  other: "Other",
  unknown: "Unknown",
};

export type VatStatus = "inclusive" | "exclusive" | "unknown";

export type PricingBasis = "each" | "metre" | "length" | "pack" | "box" | "kg" | "tonne" | "litre" | "m2" | "m3" | "day" | "hour" | "other";

export type MatchType = "exact" | "comparable" | "unknown";

/** Deterministically detected from domain/content (source-origin.ts) — never self-reported by the model. "unknown" is the honest default when no signal is available; it is treated as part of the default comparable set, only "international" is excluded/deprioritised. */
export type SourceOrigin = "south_africa" | "international" | "unknown";

/** Per-source evidence quality. "unverified" = the provider's structured output cited this URL, but it did not appear in the web-search tool's own grounding citations — never shown to the estimator as reliable (spec §7, §23). */
export type SourceEvidenceQuality = "strong" | "reasonable" | "limited" | "unverified";

/** Aggregate, user-facing evidence quality for a whole research run (spec §17). */
export type MarketEvidenceQuality = "strong" | "reasonable" | "limited" | "none";

export const MARKET_EVIDENCE_QUALITY_LABELS: Record<MarketEvidenceQuality, string> = {
  strong: "Strong market evidence",
  reasonable: "Reasonable market evidence",
  limited: "Limited market evidence",
  none: "No reliable market evidence found",
};

/** One source, exactly as the provider returned it — before normalisation or verification. */
export type MarketEvidenceItem = {
  supplierName: string;
  sourceTitle: string | null;
  sourceUrl: string;
  productDescription: string;
  manufacturer: string | null;
  brand: string | null;
  specification: string | null;
  dimensions: string | null;
  /** Null means PRICE_NOT_PUBLISHED — the source had no actual listed price. Never 0 as a placeholder for "no price found" (a source may legitimately be free, but that is vanishingly rare for construction materials/equipment and must come from an explicit stated price, not an absence of one). */
  sourcePrice: number | null;
  currency: string;
  vatStatus: VatStatus;
  pricingBasis: PricingBasis;
  packQuantity: number | null;
  deliveryStatus: string | null;
  geographicRelevance: string | null;
  evidenceClassification: MarketEvidenceClassification;
  matchType: MatchType;
  sourceDate: string | null;
  notes: string | null;
};

export type MarketResearchProviderResult =
  | { status: "complete"; evidence: MarketEvidenceItem[]; citedUrls: string[] }
  | { status: "no_result"; reason: string }
  | { status: "failed"; error: string };

/** The single seam a future provider (specialist search API, supplier API, procurement database) implements — nothing downstream needs to change. */
export type MarketResearchProvider = {
  name: string;
  isConfigured(): boolean;
  research(spec: MarketSearchSpecification): Promise<MarketResearchProviderResult>;
};

/** One source after unit/pack/VAT normalisation and verification (normalise-evidence.ts). What actually gets persisted and shown. */
export type NormalisedMarketEvidence = MarketEvidenceItem & {
  sourceDomain: string;
  sourceOrigin: SourceOrigin;
  normalisedUnit: string | null;
  normalisedPrice: number | null;
  normalisationCalculation: string | null;
  evidenceQuality: SourceEvidenceQuality;
  verified: boolean;
};

export type MarketResearchStatus = "pending" | "researching" | "complete" | "no_result" | "needs_review" | "failed";

export type ObservedRange = { min: number; max: number; unit: string; sourceCount: number };

/** Full result of one research run — what the service returns and the repository persists. */
export type MarketResearchResult = {
  runId: string;
  status: MarketResearchStatus;
  provider: string;
  searchSpec: MarketSearchSpecification;
  evidence: NormalisedMarketEvidence[];
  overallConfidence: MarketEvidenceQuality;
  observedRange: ObservedRange | null;
  representativeBaseline: number | null;
  highVariance: boolean;
  /** Set when the baseline/range couldn't be (fully) computed and why — e.g. "insufficient exact/equivalent sources", or fragmented across different specifications. Never silently blended into a number. */
  comparabilityNote: string | null;
  /** True when zero South-African-or-unknown-origin sources existed and the baseline had to fall back to international evidence. */
  usedInternationalFallback: boolean;
  errorMessage: string | null;
  researchedAt: string | null;
  cached: boolean;
};

/** One accepted evidence row as captured into a saved-decision snapshot — same shape as the persisted row (repository.ts's PersistedEvidence), inlined here so this module doesn't need to import the Supabase-facing repository. */
export type MarketResearchSnapshotEvidence = NormalisedMarketEvidence & {
  id: string;
  isManual: boolean;
  quoteReference: string | null;
  retrievedAt: string;
};

/** What gets written to boq_line_items.market_research_snapshot when the estimator saves a decision with rate_source = 'online' (spec §21) — same convention as StoredBenchmarkSnapshot. */
export type MarketResearchSnapshot = {
  runStatus: MarketResearchStatus | null;
  overallConfidence: MarketEvidenceQuality;
  observedRange: ObservedRange | null;
  representativeBaseline: number | null;
  highVariance: boolean;
  comparabilityNote: string | null;
  researchedAt: string | null;
  acceptedEvidence: MarketResearchSnapshotEvidence[];
};

/** Estimator-entered supplier quote — same evidence shape as web-research findings so both sit side by side in the UI (spec §28). A manual quote always has an actual price the estimator typed in — never PRICE_NOT_PUBLISHED. */
export type ManualMarketEvidenceInput = {
  supplierName: string;
  quoteReference: string | null;
  sourcePrice: number;
  pricingBasis: PricingBasis;
  vatStatus: VatStatus;
  quoteDate: string | null;
  notes: string | null;
};
