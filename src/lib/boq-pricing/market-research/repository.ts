import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  MarketEvidenceQuality,
  MarketResearchStatus,
  MarketSearchSpecification,
  NormalisedMarketEvidence,
  ObservedRange,
} from "./types";

export type LineItemContext = {
  organisationId: string;
  projectId: string;
  boqId: string;
  description: string;
  unit: string | null;
  category: string | null;
  province: string | null;
  town: string | null;
};

export type PersistedEvidence = NormalisedMarketEvidence & {
  id: string;
  isAccepted: boolean;
  rejectionReason: string | null;
  isManual: boolean;
  quoteReference: string | null;
  retrievedAt: string;
};

export type CachedRun = {
  runId: string;
  status: MarketResearchStatus;
  searchSpec: MarketSearchSpecification;
  evidence: PersistedEvidence[];
  overallConfidence: MarketEvidenceQuality;
  observedRange: ObservedRange | null;
  representativeBaseline: number | null;
  highVariance: boolean;
  comparabilityNote: string | null;
  errorMessage: string | null;
  researchedAt: string | null;
};

export type RunResultUpdate = {
  status: MarketResearchStatus;
  errorMessage: string | null;
  overallConfidence: MarketEvidenceQuality | null;
  observedRange: ObservedRange | null;
  representativeBaseline: number | null;
  highVariance: boolean;
  comparabilityNote: string | null;
  researchedAt: string | null;
};

/**
 * Narrow port over Supabase, same rationale as SemanticSearchRepository
 * (embeddings/semantic-search.ts) — keeps service.ts testable against an
 * in-memory fake instead of mocking Supabase's chainable query builder.
 */
export type MarketResearchRepository = {
  getLineItemContext(lineItemId: string): Promise<LineItemContext | null>;
  findFreshCompletedRun(params: {
    organisationId: string;
    lineItemId: string;
    searchSpecHash: string;
    provider: string;
    notOlderThanIso: string;
  }): Promise<CachedRun | null>;
  createRun(params: {
    organisationId: string;
    projectId: string;
    boqId: string;
    lineItemId: string;
    provider: string;
    searchSpec: MarketSearchSpecification;
    searchSpecHash: string;
    requestedBy: string | null;
  }): Promise<string>;
  saveRunResult(runId: string, result: RunResultUpdate): Promise<void>;
  insertEvidence(
    runId: string,
    context: { organisationId: string; projectId: string; lineItemId: string },
    evidence: NormalisedMarketEvidence[],
    createdBy: string | null,
  ): Promise<void>;
  insertManualEvidence(
    context: { organisationId: string; projectId: string; lineItemId: string },
    input: {
      supplierName: string;
      quoteReference: string | null;
      sourcePrice: number;
      pricingBasis: NormalisedMarketEvidence["pricingBasis"];
      vatStatus: NormalisedMarketEvidence["vatStatus"];
      sourceDate: string | null;
      notes: string | null;
    },
    createdBy: string | null,
  ): Promise<void>;
  getEvidenceForLineItem(lineItemId: string): Promise<PersistedEvidence[]>;
  setEvidenceAccepted(evidenceId: string, isAccepted: boolean, rejectionReason: string | null): Promise<void>;
};

const EVIDENCE_COLUMNS =
  "id, supplier_name, source_title, source_url, source_domain, source_origin, product_description, manufacturer, brand, specification, dimensions, source_price, currency, vat_status, pricing_basis, pack_quantity, normalised_unit, normalised_price, normalisation_calculation, delivery_status, geographic_relevance, evidence_classification, match_type, evidence_quality, verified, is_accepted, rejection_reason, is_manual, quote_reference, source_date, retrieved_at, notes";

type EvidenceRow = Database["public"]["Tables"]["market_evidence"]["Row"];
type EvidenceSelectRow = Pick<
  EvidenceRow,
  | "id"
  | "supplier_name"
  | "source_title"
  | "source_url"
  | "source_domain"
  | "source_origin"
  | "product_description"
  | "manufacturer"
  | "brand"
  | "specification"
  | "dimensions"
  | "source_price"
  | "currency"
  | "vat_status"
  | "pricing_basis"
  | "pack_quantity"
  | "normalised_unit"
  | "normalised_price"
  | "normalisation_calculation"
  | "delivery_status"
  | "geographic_relevance"
  | "evidence_classification"
  | "match_type"
  | "evidence_quality"
  | "verified"
  | "is_accepted"
  | "rejection_reason"
  | "is_manual"
  | "quote_reference"
  | "source_date"
  | "retrieved_at"
  | "notes"
>;

function rowToEvidence(row: EvidenceSelectRow): PersistedEvidence {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url ?? "",
    sourceDomain: row.source_domain ?? "",
    sourceOrigin: row.source_origin,
    productDescription: row.product_description ?? "",
    manufacturer: row.manufacturer,
    brand: row.brand,
    specification: row.specification,
    dimensions: row.dimensions,
    sourcePrice: row.source_price,
    currency: row.currency,
    vatStatus: row.vat_status,
    pricingBasis: row.pricing_basis ?? "other",
    packQuantity: row.pack_quantity,
    deliveryStatus: row.delivery_status,
    geographicRelevance: row.geographic_relevance,
    evidenceClassification: row.evidence_classification,
    matchType: row.match_type,
    sourceDate: row.source_date,
    notes: row.notes,
    normalisedUnit: row.normalised_unit,
    normalisedPrice: row.normalised_price,
    normalisationCalculation: row.normalisation_calculation,
    evidenceQuality: row.evidence_quality,
    verified: row.verified,
    isAccepted: row.is_accepted,
    rejectionReason: row.rejection_reason,
    isManual: row.is_manual,
    quoteReference: row.quote_reference,
    retrievedAt: row.retrieved_at,
  };
}

export function createSupabaseMarketResearchRepository(supabase: SupabaseClient<Database>): MarketResearchRepository {
  return {
    async getLineItemContext(lineItemId) {
      const { data: item, error } = await supabase
        .from("boq_line_items")
        .select("organisation_id, project_id, boq_id, description, normalised_description, unit, normalised_unit, construction_category")
        .eq("id", lineItemId)
        .single();
      if (error || !item) return null;

      const { data: project } = await supabase.from("projects").select("province, town").eq("id", item.project_id).maybeSingle();

      return {
        organisationId: item.organisation_id,
        projectId: item.project_id,
        boqId: item.boq_id,
        description: item.normalised_description ?? item.description,
        unit: item.normalised_unit ?? item.unit,
        category: item.construction_category,
        province: project?.province ?? null,
        town: project?.town ?? null,
      };
    },

    async findFreshCompletedRun({ organisationId, lineItemId, searchSpecHash, provider, notOlderThanIso }) {
      const { data: run } = await supabase
        .from("market_research_runs")
        .select(
          "id, status, search_spec, error_message, overall_confidence, observed_range_min, observed_range_max, observed_range_unit, representative_baseline, high_variance, comparability_note, researched_at",
        )
        .eq("organisation_id", organisationId)
        .eq("line_item_id", lineItemId)
        .eq("search_spec_hash", searchSpecHash)
        .eq("provider", provider)
        .eq("status", "complete")
        .gte("researched_at", notOlderThanIso)
        .order("researched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!run) return null;

      const { data: evidenceRows } = await supabase.from("market_evidence").select(EVIDENCE_COLUMNS).eq("research_run_id", run.id);

      return {
        runId: run.id,
        status: run.status,
        searchSpec: run.search_spec as unknown as MarketSearchSpecification,
        evidence: (evidenceRows ?? []).map(rowToEvidence),
        overallConfidence: run.overall_confidence ?? "none",
        observedRange:
          run.observed_range_min !== null && run.observed_range_max !== null && run.observed_range_unit
            ? { min: run.observed_range_min, max: run.observed_range_max, unit: run.observed_range_unit, sourceCount: (evidenceRows ?? []).length }
            : null,
        representativeBaseline: run.representative_baseline,
        highVariance: run.high_variance,
        comparabilityNote: run.comparability_note,
        errorMessage: run.error_message,
        researchedAt: run.researched_at,
      };
    },

    async createRun({ organisationId, projectId, boqId, lineItemId, provider, searchSpec, searchSpecHash, requestedBy }) {
      const { data, error } = await supabase
        .from("market_research_runs")
        .insert({
          organisation_id: organisationId,
          project_id: projectId,
          boq_id: boqId,
          line_item_id: lineItemId,
          provider,
          search_spec: searchSpec,
          search_spec_hash: searchSpecHash,
          status: "researching",
          requested_by: requestedBy,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create market research run.");
      return data.id;
    },

    async saveRunResult(runId, result) {
      const { error } = await supabase
        .from("market_research_runs")
        .update({
          status: result.status,
          error_message: result.errorMessage,
          overall_confidence: result.overallConfidence,
          observed_range_min: result.observedRange?.min ?? null,
          observed_range_max: result.observedRange?.max ?? null,
          observed_range_unit: result.observedRange?.unit ?? null,
          representative_baseline: result.representativeBaseline,
          high_variance: result.highVariance,
          comparability_note: result.comparabilityNote,
          researched_at: result.researchedAt,
        })
        .eq("id", runId);
      if (error) throw new Error(error.message);
    },

    async insertEvidence(runId, context, evidence, createdBy) {
      if (evidence.length === 0) return;
      const { error } = await supabase.from("market_evidence").insert(
        evidence.map((item) => ({
          research_run_id: runId,
          organisation_id: context.organisationId,
          project_id: context.projectId,
          line_item_id: context.lineItemId,
          supplier_name: item.supplierName,
          source_title: item.sourceTitle,
          source_url: item.sourceUrl,
          source_domain: item.sourceDomain,
          source_origin: item.sourceOrigin,
          product_description: item.productDescription,
          manufacturer: item.manufacturer,
          brand: item.brand,
          specification: item.specification,
          dimensions: item.dimensions,
          source_price: item.sourcePrice,
          currency: item.currency,
          vat_status: item.vatStatus,
          pricing_basis: item.pricingBasis,
          pack_quantity: item.packQuantity,
          normalised_unit: item.normalisedUnit,
          normalised_price: item.normalisedPrice,
          normalisation_calculation: item.normalisationCalculation,
          delivery_status: item.deliveryStatus,
          geographic_relevance: item.geographicRelevance,
          evidence_classification: item.evidenceClassification,
          match_type: item.matchType,
          evidence_quality: item.evidenceQuality,
          verified: item.verified,
          is_accepted: item.verified,
          is_manual: false,
          source_date: item.sourceDate,
          notes: item.notes,
          created_by: createdBy,
        })),
      );
      if (error) throw new Error(error.message);
    },

    async insertManualEvidence(context, input, createdBy) {
      const { error } = await supabase.from("market_evidence").insert({
        research_run_id: null,
        organisation_id: context.organisationId,
        project_id: context.projectId,
        line_item_id: context.lineItemId,
        supplier_name: input.supplierName,
        source_price: input.sourcePrice,
        currency: "ZAR",
        vat_status: input.vatStatus,
        pricing_basis: input.pricingBasis,
        evidence_classification: "unknown",
        match_type: "unknown",
        evidence_quality: "limited",
        verified: false,
        is_accepted: true,
        is_manual: true,
        quote_reference: input.quoteReference,
        source_date: input.sourceDate,
        notes: input.notes,
        created_by: createdBy,
      });
      if (error) throw new Error(error.message);
    },

    async getEvidenceForLineItem(lineItemId) {
      const { data } = await supabase
        .from("market_evidence")
        .select(EVIDENCE_COLUMNS)
        .eq("line_item_id", lineItemId)
        .order("retrieved_at", { ascending: false });
      return (data ?? []).map(rowToEvidence);
    },

    async setEvidenceAccepted(evidenceId, isAccepted, rejectionReason) {
      const { error } = await supabase.from("market_evidence").update({ is_accepted: isAccepted, rejection_reason: rejectionReason }).eq("id", evidenceId);
      if (error) throw new Error(error.message);
    },
  };
}
