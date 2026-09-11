-- Phase 5: real extraction + estimator benchmarking for the BOQ currently
-- being priced. A subsystem parallel to (and read-only towards) the
-- Historical BOQ Library: boq_line_items holds the CURRENT tender's own
-- extracted rows, never rate_library_items rows. Nothing here writes to
-- historical_boq_items, rate_library_items, normalised_description, or
-- duplicate_group_key — the two pipelines only share pure deterministic
-- functions (normaliseDescription, normaliseUnit, classifyHierarchical,
-- classifyCategory), never tables or rows.

-- ---------------------------------------------------------------------------
-- Storage: original current-pricing BOQ files (Excel or PDF). Previously
-- uploadBoq() discarded the file after counting pages; real extraction needs
-- the bytes, so this bucket mirrors historical-boqs' private, folder-scoped
-- convention exactly.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pricing-boqs', 'pricing-boqs', false)
on conflict (id) do nothing;

create policy "Organisation members can read their pricing BOQ files"
  on storage.objects for select
  using (
    bucket_id = 'pricing-boqs'
    and (storage.foldername(name))[1] = (public.current_organisation_id())::text
  );

create policy "Organisation members can upload their pricing BOQ files"
  on storage.objects for insert
  with check (
    bucket_id = 'pricing-boqs'
    and (storage.foldername(name))[1] = (public.current_organisation_id())::text
  );

-- ---------------------------------------------------------------------------
-- boqs previously never stored the uploaded file (bytes were read in-memory
-- only to count PDF pages, then discarded) — real extraction needs them.
-- Nullable: existing rows from before this migration have neither.
-- ---------------------------------------------------------------------------
alter table public.boqs
  add column if not exists storage_path text,
  add column if not exists source_format text check (source_format in ('excel', 'pdf'));

-- ---------------------------------------------------------------------------
-- BOQ Line Items: every extracted row of the BOQ currently being priced.
-- Shape mirrors historical_boq_items (raw extraction fields) plus the
-- normalisation fields needed to query rate_library_items for benchmarking,
-- plus the estimator's own durable decision. Historical benchmark evidence
-- itself is computed on demand (via the existing read-only semantic search)
-- and never persisted here — only the estimator's final call is durable
-- state.
-- ---------------------------------------------------------------------------
create table if not exists public.boq_line_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  boq_id uuid not null references public.boqs (id) on delete cascade,

  row_number integer not null,
  row_type text not null default 'rate_item' check (row_type in (
    'rate_item', 'bill_heading', 'section_heading', 'subtotal_total',
    'preliminary_general', 'note_specification', 'contractual_text', 'general_text'
  )),
  section text,
  item_code text,
  description text not null,
  unit text,
  quantity numeric,
  unit_rate numeric,
  amount numeric,
  category text,
  status text not null default 'ok' check (status in ('ok', 'needs_review', 'error')),
  validation_errors jsonb,
  raw_row jsonb,
  source_format text not null check (source_format in ('excel', 'pdf')),

  -- Deterministic normalisation (rate_item rows only) — reused pure
  -- functions, computed and stored here, never written back to any
  -- historical-library table.
  normalised_description text,
  normalised_unit text,
  category_division text,
  construction_category text,

  -- The estimator's own decision. Never set automatically.
  estimator_rate numeric,
  rate_source text check (rate_source in ('historical', 'online', 'build_up', 'manual')),
  rate_notes text,
  priced_at timestamptz,
  priced_by uuid references public.profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boq_line_items enable row level security;

create policy "Organisation members can manage their BOQ line items"
  on public.boq_line_items for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists boq_line_items_boq_id_idx on public.boq_line_items (boq_id);
create index if not exists boq_line_items_org_project_idx on public.boq_line_items (organisation_id, project_id);

-- ---------------------------------------------------------------------------
-- Pricing Markup Settings: one row per organisation. Configurable defaults
-- for the cost build-up engine — deliberately not hard-coded. Editable from
-- the existing /dashboard/settings page.
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_markup_settings (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  wastage_percent numeric not null default 5,
  site_overhead_percent numeric not null default 8,
  head_office_overhead_percent numeric not null default 5,
  profit_percent numeric not null default 10,
  contingency_percent numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.pricing_markup_settings enable row level security;

create policy "Organisation members can manage their pricing markup settings"
  on public.pricing_markup_settings for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());
