-- Phase 6: current market/material price research. Two new tables, scoped
-- and RLS-protected exactly like boq_line_items (organisation_id =
-- current_organisation_id()) — a research run and its evidence rows never
-- touch rate_library_items, historical_boq_items, normalised_description,
-- or duplicate_group_key. Purely additive alongside the existing historical
-- benchmark/cost-build-up snapshot columns added in migration 11.

-- ---------------------------------------------------------------------------
-- One row per research operation ("research this item" / a batch member).
-- search_spec_hash is the cache key: a later request for the same
-- specification/unit/location/provider combination can reuse a recent
-- COMPLETE run instead of calling the provider again (spec §14) — the
-- freshness window itself is enforced in application code
-- (marketResearchConfig.cacheTtlDays), not here, so it stays configurable
-- without a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.market_research_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  boq_id uuid not null references public.boqs (id) on delete cascade,
  line_item_id uuid not null references public.boq_line_items (id) on delete cascade,

  provider text not null,
  search_spec jsonb not null,
  search_spec_hash text not null,

  status text not null default 'pending' check (status in ('pending', 'researching', 'complete', 'no_result', 'needs_review', 'failed')),
  error_message text,

  overall_confidence text check (overall_confidence in ('strong', 'reasonable', 'limited', 'none')),
  observed_range_min numeric,
  observed_range_max numeric,
  observed_range_unit text,
  representative_baseline numeric,
  high_variance boolean not null default false,

  requested_by uuid references public.profiles (id),
  researched_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.market_research_runs enable row level security;

create policy "Organisation members can manage their market research runs"
  on public.market_research_runs for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists market_research_runs_line_item_idx on public.market_research_runs (line_item_id);
create index if not exists market_research_runs_cache_lookup_idx on public.market_research_runs (organisation_id, search_spec_hash, provider, status, researched_at desc);

-- ---------------------------------------------------------------------------
-- One row per source (web-research finding or manual/estimator-entered
-- supplier quote — is_manual distinguishes them, both share this table so
-- the UI shows both kinds of evidence side by side, spec §28).
-- research_run_id is null for manual entries. Every column here mirrors a
-- field the spec requires for auditability (§6) — nothing beyond that is
-- stored, and no OpenAI/API credential is ever persisted here.
-- ---------------------------------------------------------------------------
create table if not exists public.market_evidence (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.market_research_runs (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  line_item_id uuid not null references public.boq_line_items (id) on delete cascade,

  supplier_name text not null,
  source_title text,
  source_url text,
  source_domain text,
  product_description text,
  manufacturer text,
  brand text,
  specification text,
  dimensions text,

  source_price numeric,
  currency text not null default 'ZAR',
  vat_status text not null default 'unknown' check (vat_status in ('inclusive', 'exclusive', 'unknown')),
  pricing_basis text check (pricing_basis in ('each', 'metre', 'length', 'pack', 'box', 'kg', 'tonne', 'litre', 'm2', 'm3', 'day', 'hour', 'other')),
  pack_quantity numeric,

  normalised_unit text,
  normalised_price numeric,
  normalisation_calculation text,

  delivery_status text,
  geographic_relevance text,

  evidence_classification text not null default 'unknown' check (evidence_classification in (
    'material_product_price', 'supply_only_price', 'supply_and_install_price', 'installed_service_rate',
    'equipment_hire_rate', 'subcontractor_specialist_price', 'other', 'unknown'
  )),
  match_type text not null default 'unknown' check (match_type in ('exact', 'comparable', 'unknown')),

  -- 'unverified' = the AI-returned URL did not appear among the web-search
  -- tool's own grounding citations for this run — kept for audit/estimator
  -- judgement, never treated as reliable evidence (spec §7, §23).
  evidence_quality text not null default 'unverified' check (evidence_quality in ('strong', 'reasonable', 'limited', 'unverified')),
  verified boolean not null default false,

  is_accepted boolean not null default true,
  rejection_reason text,

  is_manual boolean not null default false,
  quote_reference text,

  source_date date,
  retrieved_at timestamptz not null default now(),
  notes text,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.market_evidence enable row level security;

create policy "Organisation members can manage their market evidence"
  on public.market_evidence for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists market_evidence_research_run_idx on public.market_evidence (research_run_id);
create index if not exists market_evidence_line_item_idx on public.market_evidence (line_item_id);

-- ---------------------------------------------------------------------------
-- Saved-decision snapshot, same convention as benchmark_snapshot /
-- cost_buildup_components (migration 11): captured only when the estimator
-- saves a decision with rate_source = 'online', so a later refreshed
-- research run never silently rewrites a previously saved tender decision
-- (spec §21).
-- ---------------------------------------------------------------------------
alter table public.boq_line_items
  add column if not exists market_research_snapshot jsonb;

comment on column public.boq_line_items.market_research_snapshot is
  'Snapshot of the selected/normalised market evidence (sources, prices, VAT status, research date) the estimator was looking at when they saved a decision with rate_source = online. Never set automatically.';
