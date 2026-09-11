// Hand-authored to match supabase/migrations/*.sql.
// Regenerate from the live schema once the Supabase CLI is linked:
//
//   npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
//
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus = "draft" | "active" | "submitted" | "won" | "lost" | "archived";
export type ProjectSector = "building" | "civil" | "electrical" | "mechanical";
export type ProcessingJobStatus =
  | "UPLOADED"
  | "WAITING_FOR_PAYMENT"
  | "PAYMENT_VERIFIED"
  | "QUEUED"
  | "PREPARING_DOCUMENT"
  | "AI_EXTRACTION"
  | "NORMALISING_DATA"
  | "BENCHMARKING"
  | "RATE_RECOMMENDATION"
  | "GENERATING_EXPORT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type ProcessingJobPriority = "low" | "normal" | "high";
export type ProjectTimelineEventType =
  | "created"
  | "boq_uploaded"
  | "payment_received"
  | "processing_started"
  | "ai_extraction_completed"
  | "benchmark_completed"
  | "pricing_completed"
  | "export_generated";
export type ExportType = "excel" | "pdf";
export type HistoricalBoqSourceType = "excel" | "pdf" | "word";
export type HistoricalBoqProcessingJobStatus =
  | "UPLOADED"
  | "PARSING"
  | "VALIDATING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";
export type HistoricalBoqItemStatus = "ok" | "needs_review" | "error";
export type HistoricalBoqRowType =
  | "rate_item"
  | "bill_heading"
  | "section_heading"
  | "subtotal_total"
  | "preliminary_general"
  | "note_specification"
  | "contractual_text"
  | "general_text";
export type BoqLineItemRowType = HistoricalBoqRowType;
export type BoqLineItemStatus = "ok" | "needs_review" | "error";
export type BoqLineItemSourceFormat = "excel" | "pdf";
export type BoqLineItemRateSource = "historical" | "online" | "build_up" | "manual";

export type MarketResearchStatus = "pending" | "researching" | "complete" | "no_result" | "needs_review" | "failed";
export type MarketEvidenceQuality = "strong" | "reasonable" | "limited" | "none";
export type MarketVatStatus = "inclusive" | "exclusive" | "unknown";
export type MarketPricingBasis = "each" | "metre" | "length" | "pack" | "box" | "kg" | "tonne" | "litre" | "m2" | "m3" | "day" | "hour" | "other";
export type MarketEvidenceClassification =
  | "material_product_price"
  | "supply_only_price"
  | "supply_and_install_price"
  | "installed_service_rate"
  | "equipment_hire_rate"
  | "subcontractor_specialist_price"
  | "other"
  | "unknown";
export type MarketMatchType = "exact" | "comparable" | "unknown";
export type SourceEvidenceQuality = "strong" | "reasonable" | "limited" | "unverified";
export type MarketSourceOrigin = "south_africa" | "international" | "unknown";

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organisation_id: string;
          role: "user" | "admin";
          full_name: string | null;
          company_name: string | null;
          free_boq_used: boolean;
          free_boq_used_at: string | null;
          paid_boq_count: number;
          total_pages_processed: number;
          lifetime_spend: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organisation_id: string;
          role?: "user" | "admin";
          full_name?: string | null;
          company_name?: string | null;
          free_boq_used?: boolean;
          free_boq_used_at?: string | null;
          paid_boq_count?: number;
          total_pages_processed?: number;
          lifetime_spend?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          role?: "user" | "admin";
          full_name?: string | null;
          company_name?: string | null;
          free_boq_used?: boolean;
          free_boq_used_at?: string | null;
          paid_boq_count?: number;
          total_pages_processed?: number;
          lifetime_spend?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          organisation_id: string;
          created_by: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          project_number: string | null;
          tender_number: string | null;
          contract_number: string | null;
          client_name: string | null;
          contractor_name: string | null;
          province: string | null;
          municipality: string | null;
          town: string | null;
          physical_address: string | null;
          sector: ProjectSector[];
          estimated_contract_value: number | null;
          tender_closing_date: string | null;
          award_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          project_number?: string | null;
          tender_number?: string | null;
          contract_number?: string | null;
          client_name?: string | null;
          contractor_name?: string | null;
          province?: string | null;
          municipality?: string | null;
          town?: string | null;
          physical_address?: string | null;
          sector?: ProjectSector[];
          estimated_contract_value?: number | null;
          tender_closing_date?: string | null;
          award_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          created_by?: string;
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          project_number?: string | null;
          tender_number?: string | null;
          contract_number?: string | null;
          client_name?: string | null;
          contractor_name?: string | null;
          province?: string | null;
          municipality?: string | null;
          town?: string | null;
          physical_address?: string | null;
          sector?: ProjectSector[];
          estimated_contract_value?: number | null;
          tender_closing_date?: string | null;
          award_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      project_versions: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          version_label: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_number: number;
          version_label: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          version_number?: number;
          version_label?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      boq_items: {
        Row: {
          id: string;
          project_id: string;
          item_code: string | null;
          description: string;
          unit: string;
          quantity: number;
          unit_rate: number;
          benchmark_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          item_code?: string | null;
          description: string;
          unit: string;
          quantity?: number;
          unit_rate?: number;
          benchmark_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          item_code?: string | null;
          description?: string;
          unit?: string;
          quantity?: number;
          unit_rate?: number;
          benchmark_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boq_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      boqs: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          project_version_id: string | null;
          filename: string;
          file_size_bytes: number | null;
          page_count: number;
          pricing_tier: string;
          price: number;
          currency: string;
          is_free: boolean;
          storage_path: string | null;
          source_format: BoqLineItemSourceFormat | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          project_version_id?: string | null;
          filename: string;
          file_size_bytes?: number | null;
          page_count: number;
          pricing_tier: string;
          price?: number;
          currency?: string;
          is_free?: boolean;
          storage_path?: string | null;
          source_format?: BoqLineItemSourceFormat | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          project_version_id?: string | null;
          filename?: string;
          file_size_bytes?: number | null;
          page_count?: number;
          pricing_tier?: string;
          price?: number;
          currency?: string;
          is_free?: boolean;
          storage_path?: string | null;
          source_format?: BoqLineItemSourceFormat | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boqs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_project_version_id_fkey";
            columns: ["project_version_id"];
            isOneToOne: false;
            referencedRelation: "project_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      processing_jobs: {
        Row: {
          id: string;
          job_number: number;
          boq_id: string;
          project_id: string;
          status: ProcessingJobStatus;
          progress: number;
          priority: ProcessingJobPriority;
          estimated_completion: string | null;
          started_at: string | null;
          completed_at: string | null;
          retry_count: number;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_number?: number;
          boq_id: string;
          project_id: string;
          status?: ProcessingJobStatus;
          progress?: number;
          priority?: ProcessingJobPriority;
          estimated_completion?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          retry_count?: number;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_number?: number;
          boq_id?: string;
          project_id?: string;
          status?: ProcessingJobStatus;
          progress?: number;
          priority?: ProcessingJobPriority;
          estimated_completion?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          retry_count?: number;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "processing_jobs_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: true;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processing_jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      boq_line_items: {
        Row: {
          id: string;
          organisation_id: string;
          project_id: string;
          boq_id: string;
          row_number: number;
          row_type: BoqLineItemRowType;
          section: string | null;
          item_code: string | null;
          description: string;
          unit: string | null;
          quantity: number | null;
          unit_rate: number | null;
          amount: number | null;
          category: string | null;
          status: BoqLineItemStatus;
          validation_errors: Json | null;
          raw_row: Json | null;
          source_format: BoqLineItemSourceFormat;
          normalised_description: string | null;
          normalised_unit: string | null;
          category_division: string | null;
          construction_category: string | null;
          estimator_rate: number | null;
          rate_source: BoqLineItemRateSource | null;
          rate_notes: string | null;
          priced_at: string | null;
          priced_by: string | null;
          cost_buildup_components: Json | null;
          cost_buildup_markups: Json | null;
          benchmark_snapshot: Json | null;
          system_suggested_snapshot: Json | null;
          system_suggested_at: string | null;
          market_research_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          project_id: string;
          boq_id: string;
          row_number: number;
          row_type?: BoqLineItemRowType;
          section?: string | null;
          item_code?: string | null;
          description: string;
          unit?: string | null;
          quantity?: number | null;
          unit_rate?: number | null;
          amount?: number | null;
          category?: string | null;
          status?: BoqLineItemStatus;
          validation_errors?: Json | null;
          raw_row?: Json | null;
          source_format: BoqLineItemSourceFormat;
          normalised_description?: string | null;
          normalised_unit?: string | null;
          category_division?: string | null;
          construction_category?: string | null;
          estimator_rate?: number | null;
          rate_source?: BoqLineItemRateSource | null;
          rate_notes?: string | null;
          priced_at?: string | null;
          priced_by?: string | null;
          cost_buildup_components?: Json | null;
          cost_buildup_markups?: Json | null;
          benchmark_snapshot?: Json | null;
          system_suggested_snapshot?: Json | null;
          system_suggested_at?: string | null;
          market_research_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          project_id?: string;
          boq_id?: string;
          row_number?: number;
          row_type?: BoqLineItemRowType;
          section?: string | null;
          item_code?: string | null;
          description?: string;
          unit?: string | null;
          quantity?: number | null;
          unit_rate?: number | null;
          amount?: number | null;
          category?: string | null;
          status?: BoqLineItemStatus;
          validation_errors?: Json | null;
          raw_row?: Json | null;
          source_format?: BoqLineItemSourceFormat;
          normalised_description?: string | null;
          normalised_unit?: string | null;
          category_division?: string | null;
          construction_category?: string | null;
          estimator_rate?: number | null;
          rate_source?: BoqLineItemRateSource | null;
          rate_notes?: string | null;
          priced_at?: string | null;
          priced_by?: string | null;
          cost_buildup_components?: Json | null;
          cost_buildup_markups?: Json | null;
          benchmark_snapshot?: Json | null;
          system_suggested_snapshot?: Json | null;
          system_suggested_at?: string | null;
          market_research_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boq_line_items_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_line_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_line_items_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_line_items_priced_by_fkey";
            columns: ["priced_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_research_runs: {
        Row: {
          id: string;
          organisation_id: string;
          project_id: string;
          boq_id: string;
          line_item_id: string;
          provider: string;
          search_spec: Json;
          search_spec_hash: string;
          status: MarketResearchStatus;
          error_message: string | null;
          overall_confidence: MarketEvidenceQuality | null;
          observed_range_min: number | null;
          observed_range_max: number | null;
          observed_range_unit: string | null;
          representative_baseline: number | null;
          high_variance: boolean;
          comparability_note: string | null;
          requested_by: string | null;
          researched_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          project_id: string;
          boq_id: string;
          line_item_id: string;
          provider: string;
          search_spec: Json;
          search_spec_hash: string;
          status?: MarketResearchStatus;
          error_message?: string | null;
          overall_confidence?: MarketEvidenceQuality | null;
          observed_range_min?: number | null;
          observed_range_max?: number | null;
          observed_range_unit?: string | null;
          representative_baseline?: number | null;
          high_variance?: boolean;
          comparability_note?: string | null;
          requested_by?: string | null;
          researched_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          project_id?: string;
          boq_id?: string;
          line_item_id?: string;
          provider?: string;
          search_spec?: Json;
          search_spec_hash?: string;
          status?: MarketResearchStatus;
          error_message?: string | null;
          overall_confidence?: MarketEvidenceQuality | null;
          observed_range_min?: number | null;
          observed_range_max?: number | null;
          observed_range_unit?: string | null;
          representative_baseline?: number | null;
          high_variance?: boolean;
          comparability_note?: string | null;
          requested_by?: string | null;
          researched_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_research_runs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_research_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_research_runs_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_research_runs_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_line_items";
            referencedColumns: ["id"];
          },
        ];
      };
      market_evidence: {
        Row: {
          id: string;
          research_run_id: string | null;
          organisation_id: string;
          project_id: string;
          line_item_id: string;
          supplier_name: string;
          source_title: string | null;
          source_url: string | null;
          source_domain: string | null;
          source_origin: MarketSourceOrigin;
          product_description: string | null;
          manufacturer: string | null;
          brand: string | null;
          specification: string | null;
          dimensions: string | null;
          source_price: number | null;
          currency: string;
          vat_status: MarketVatStatus;
          pricing_basis: MarketPricingBasis | null;
          pack_quantity: number | null;
          normalised_unit: string | null;
          normalised_price: number | null;
          normalisation_calculation: string | null;
          delivery_status: string | null;
          geographic_relevance: string | null;
          evidence_classification: MarketEvidenceClassification;
          match_type: MarketMatchType;
          evidence_quality: SourceEvidenceQuality;
          verified: boolean;
          is_accepted: boolean;
          rejection_reason: string | null;
          is_manual: boolean;
          quote_reference: string | null;
          source_date: string | null;
          retrieved_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          research_run_id?: string | null;
          organisation_id: string;
          project_id: string;
          line_item_id: string;
          supplier_name: string;
          source_title?: string | null;
          source_url?: string | null;
          source_domain?: string | null;
          source_origin?: MarketSourceOrigin;
          product_description?: string | null;
          manufacturer?: string | null;
          brand?: string | null;
          specification?: string | null;
          dimensions?: string | null;
          source_price?: number | null;
          currency?: string;
          vat_status?: MarketVatStatus;
          pricing_basis?: MarketPricingBasis | null;
          pack_quantity?: number | null;
          normalised_unit?: string | null;
          normalised_price?: number | null;
          normalisation_calculation?: string | null;
          delivery_status?: string | null;
          geographic_relevance?: string | null;
          evidence_classification?: MarketEvidenceClassification;
          match_type?: MarketMatchType;
          evidence_quality?: SourceEvidenceQuality;
          verified?: boolean;
          is_accepted?: boolean;
          rejection_reason?: string | null;
          is_manual?: boolean;
          quote_reference?: string | null;
          source_date?: string | null;
          retrieved_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          research_run_id?: string | null;
          organisation_id?: string;
          project_id?: string;
          line_item_id?: string;
          supplier_name?: string;
          source_title?: string | null;
          source_url?: string | null;
          source_domain?: string | null;
          source_origin?: MarketSourceOrigin;
          product_description?: string | null;
          manufacturer?: string | null;
          brand?: string | null;
          specification?: string | null;
          dimensions?: string | null;
          source_price?: number | null;
          currency?: string;
          vat_status?: MarketVatStatus;
          pricing_basis?: MarketPricingBasis | null;
          pack_quantity?: number | null;
          normalised_unit?: string | null;
          normalised_price?: number | null;
          normalisation_calculation?: string | null;
          delivery_status?: string | null;
          geographic_relevance?: string | null;
          evidence_classification?: MarketEvidenceClassification;
          match_type?: MarketMatchType;
          evidence_quality?: SourceEvidenceQuality;
          verified?: boolean;
          is_accepted?: boolean;
          rejection_reason?: string | null;
          is_manual?: boolean;
          quote_reference?: string | null;
          source_date?: string | null;
          retrieved_at?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_evidence_research_run_id_fkey";
            columns: ["research_run_id"];
            isOneToOne: false;
            referencedRelation: "market_research_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_evidence_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_evidence_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_evidence_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_line_items";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_markup_settings: {
        Row: {
          organisation_id: string;
          wastage_percent: number;
          site_overhead_percent: number;
          head_office_overhead_percent: number;
          profit_percent: number;
          contingency_percent: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          organisation_id: string;
          wastage_percent?: number;
          site_overhead_percent?: number;
          head_office_overhead_percent?: number;
          profit_percent?: number;
          contingency_percent?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          organisation_id?: string;
          wastage_percent?: number;
          site_overhead_percent?: number;
          head_office_overhead_percent?: number;
          profit_percent?: number;
          contingency_percent?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_markup_settings_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_markup_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_runs: {
        Row: {
          id: string;
          run_number: number;
          project_id: string;
          boq_id: string;
          created_by: string;
          ai_recommendation: Json | null;
          final_approved_rates: Json | null;
          manual_changes: Json | null;
          confidence_scores: Json | null;
          benchmark_results: Json | null;
          comments: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          run_number?: number;
          project_id: string;
          boq_id: string;
          created_by: string;
          ai_recommendation?: Json | null;
          final_approved_rates?: Json | null;
          manual_changes?: Json | null;
          confidence_scores?: Json | null;
          benchmark_results?: Json | null;
          comments?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          run_number?: number;
          project_id?: string;
          boq_id?: string;
          created_by?: string;
          ai_recommendation?: Json | null;
          final_approved_rates?: Json | null;
          manual_changes?: Json | null;
          confidence_scores?: Json | null;
          benchmark_results?: Json | null;
          comments?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_runs_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
        ];
      };
      exports: {
        Row: {
          id: string;
          project_id: string;
          boq_id: string;
          pricing_run_id: string | null;
          export_type: ExportType;
          file_path: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          boq_id: string;
          pricing_run_id?: string | null;
          export_type: ExportType;
          file_path?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          boq_id?: string;
          pricing_run_id?: string | null;
          export_type?: ExportType;
          file_path?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exports_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          organisation_id: string;
          actor_user_id: string | null;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          actor_user_id?: string | null;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          actor_user_id?: string | null;
          event_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      project_timeline: {
        Row: {
          id: string;
          project_id: string;
          event_type: ProjectTimelineEventType;
          event_at: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          event_type: ProjectTimelineEventType;
          event_at?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          event_type?: ProjectTimelineEventType;
          event_at?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_timeline_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_library_items: {
        Row: {
          id: string;
          organisation_id: string;
          source_boq_id: string | null;
          original_description: string | null;
          normalised_description: string | null;
          construction_category: string | null;
          normalised_unit: string | null;
          material_classification: string | null;
          historical_stats: Json | null;
          embedding: number[] | null;
          ai_confidence: number | null;
          category_division: string | null;
          duplicate_group_key: string | null;
          sample_count: number;
          project_count: number;
          avg_rate: number | null;
          median_rate: number | null;
          min_rate: number | null;
          max_rate: number | null;
          stddev_rate: number | null;
          most_recent_rate: number | null;
          most_recent_rate_at: string | null;
          most_recent_historical_boq_id: string | null;
          merged_into_id: string | null;
          admin_notes: string | null;
          embedding_input_text: string | null;
          embedding_model: string | null;
          embedding_generated_at: string | null;
          embedding_last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          source_boq_id?: string | null;
          original_description?: string | null;
          normalised_description?: string | null;
          construction_category?: string | null;
          normalised_unit?: string | null;
          material_classification?: string | null;
          historical_stats?: Json | null;
          embedding?: number[] | null;
          ai_confidence?: number | null;
          category_division?: string | null;
          duplicate_group_key?: string | null;
          sample_count?: number;
          project_count?: number;
          avg_rate?: number | null;
          median_rate?: number | null;
          min_rate?: number | null;
          max_rate?: number | null;
          stddev_rate?: number | null;
          most_recent_rate?: number | null;
          most_recent_rate_at?: string | null;
          most_recent_historical_boq_id?: string | null;
          merged_into_id?: string | null;
          admin_notes?: string | null;
          embedding_input_text?: string | null;
          embedding_model?: string | null;
          embedding_generated_at?: string | null;
          embedding_last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          source_boq_id?: string | null;
          original_description?: string | null;
          normalised_description?: string | null;
          construction_category?: string | null;
          normalised_unit?: string | null;
          material_classification?: string | null;
          historical_stats?: Json | null;
          embedding?: number[] | null;
          ai_confidence?: number | null;
          category_division?: string | null;
          duplicate_group_key?: string | null;
          sample_count?: number;
          project_count?: number;
          avg_rate?: number | null;
          median_rate?: number | null;
          min_rate?: number | null;
          max_rate?: number | null;
          stddev_rate?: number | null;
          most_recent_rate?: number | null;
          most_recent_rate_at?: string | null;
          most_recent_historical_boq_id?: string | null;
          merged_into_id?: string | null;
          admin_notes?: string | null;
          embedding_input_text?: string | null;
          embedding_model?: string | null;
          embedding_generated_at?: string | null;
          embedding_last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_library_items_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_library_items_source_boq_id_fkey";
            columns: ["source_boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_library_items_merged_into_id_fkey";
            columns: ["merged_into_id"];
            isOneToOne: false;
            referencedRelation: "rate_library_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_library_items_most_recent_historical_boq_id_fkey";
            columns: ["most_recent_historical_boq_id"];
            isOneToOne: false;
            referencedRelation: "historical_boqs";
            referencedColumns: ["id"];
          },
        ];
      };
      historical_boqs: {
        Row: {
          id: string;
          organisation_id: string;
          project_id: string | null;
          uploaded_by: string;
          source_type: HistoricalBoqSourceType;
          original_filename: string;
          storage_path: string;
          file_size_bytes: number | null;
          mime_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          project_id?: string | null;
          uploaded_by: string;
          source_type: HistoricalBoqSourceType;
          original_filename: string;
          storage_path: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          project_id?: string | null;
          uploaded_by?: string;
          source_type?: HistoricalBoqSourceType;
          original_filename?: string;
          storage_path?: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historical_boqs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boqs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boqs_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      historical_boq_processing_jobs: {
        Row: {
          id: string;
          job_number: number;
          historical_boq_id: string;
          organisation_id: string;
          project_id: string | null;
          status: HistoricalBoqProcessingJobStatus;
          rows_detected: number;
          rows_extracted: number;
          rows_needs_review: number;
          rows_error: number;
          error_summary: Json | null;
          failure_reason: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_number?: number;
          historical_boq_id: string;
          organisation_id: string;
          project_id?: string | null;
          status?: HistoricalBoqProcessingJobStatus;
          rows_detected?: number;
          rows_extracted?: number;
          rows_needs_review?: number;
          rows_error?: number;
          error_summary?: Json | null;
          failure_reason?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_number?: number;
          historical_boq_id?: string;
          organisation_id?: string;
          project_id?: string | null;
          status?: HistoricalBoqProcessingJobStatus;
          rows_detected?: number;
          rows_extracted?: number;
          rows_needs_review?: number;
          rows_error?: number;
          error_summary?: Json | null;
          failure_reason?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historical_boq_processing_jobs_historical_boq_id_fkey";
            columns: ["historical_boq_id"];
            isOneToOne: true;
            referencedRelation: "historical_boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boq_processing_jobs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boq_processing_jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      historical_boq_items: {
        Row: {
          id: string;
          organisation_id: string;
          project_id: string | null;
          historical_boq_id: string;
          uploaded_at: string;
          row_number: number;
          row_type: HistoricalBoqRowType;
          section: string | null;
          item_code: string | null;
          description: string;
          unit: string | null;
          quantity: number | null;
          unit_rate: number | null;
          amount: number | null;
          category: string | null;
          status: HistoricalBoqItemStatus;
          validation_errors: Json | null;
          raw_row: Json | null;
          canonical_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          project_id?: string | null;
          historical_boq_id: string;
          uploaded_at: string;
          row_number: number;
          row_type?: HistoricalBoqRowType;
          section?: string | null;
          item_code?: string | null;
          description: string;
          unit?: string | null;
          quantity?: number | null;
          unit_rate?: number | null;
          amount?: number | null;
          category?: string | null;
          status?: HistoricalBoqItemStatus;
          validation_errors?: Json | null;
          raw_row?: Json | null;
          canonical_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          project_id?: string | null;
          historical_boq_id?: string;
          uploaded_at?: string;
          row_number?: number;
          row_type?: HistoricalBoqRowType;
          section?: string | null;
          item_code?: string | null;
          description?: string;
          unit?: string | null;
          quantity?: number | null;
          unit_rate?: number | null;
          amount?: number | null;
          category?: string | null;
          status?: HistoricalBoqItemStatus;
          validation_errors?: Json | null;
          raw_row?: Json | null;
          canonical_item_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historical_boq_items_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boq_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boq_items_historical_boq_id_fkey";
            columns: ["historical_boq_id"];
            isOneToOne: false;
            referencedRelation: "historical_boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_boq_items_canonical_item_id_fkey";
            columns: ["canonical_item_id"];
            isOneToOne: false;
            referencedRelation: "rate_library_items";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          boq_id: string | null;
          payment_provider: string;
          provider_transaction_id: string | null;
          amount: number;
          currency: string;
          pricing_tier: string | null;
          payment_status: "pending" | "complete" | "failed" | "cancelled";
          payment_date: string | null;
          item_name: string | null;
          raw_itn: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          boq_id?: string | null;
          payment_provider?: string;
          provider_transaction_id?: string | null;
          amount: number;
          currency?: string;
          pricing_tier?: string | null;
          payment_status?: "pending" | "complete" | "failed" | "cancelled";
          payment_date?: string | null;
          item_name?: string | null;
          raw_itn?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          boq_id?: string | null;
          payment_provider?: string;
          provider_transaction_id?: string | null;
          amount?: number;
          currency?: string;
          pricing_tier?: string | null;
          payment_status?: "pending" | "complete" | "failed" | "cancelled";
          payment_date?: string | null;
          item_name?: string | null;
          raw_itn?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      list_historical_boq_sections: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      list_historical_boq_units: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      list_historical_boq_categories: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      recompute_rate_library_stats: {
        Args: { p_canonical_ids: string[] };
        Returns: undefined;
      };
      list_rate_library_divisions: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      list_rate_library_categories: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      list_rate_library_units: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
  };
};
