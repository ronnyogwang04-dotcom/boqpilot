-- Historical BOQ Library: a subsystem parallel to (and independent of) the
-- pricing pipeline (boqs / processing_jobs / pricing_runs). It exists purely
-- to ingest already-priced historical BOQs and store every line item so they
-- can be searched — no payment, no AI pricing. rate_library_items (from the
-- previous migration) is untouched here; it is the future normalised/AI
-- layer that will eventually read from historical_boq_items.

-- ---------------------------------------------------------------------------
-- Storage: original historical BOQ files. Private bucket — objects are only
-- readable by members of the organisation that owns them, enforced by the
-- "{organisation_id}/{historical_boq_id}/{filename}" path convention below.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('historical-boqs', 'historical-boqs', false)
on conflict (id) do nothing;

create policy "Organisation members can read their historical BOQ files"
  on storage.objects for select
  using (
    bucket_id = 'historical-boqs'
    and (storage.foldername(name))[1] = (public.current_organisation_id())::text
  );

create policy "Organisation members can upload their historical BOQ files"
  on storage.objects for insert
  with check (
    bucket_id = 'historical-boqs'
    and (storage.foldername(name))[1] = (public.current_organisation_id())::text
  );

-- ---------------------------------------------------------------------------
-- Historical BOQs: one row per uploaded file. source_type drives which
-- parser adapter handles it (only "excel" is implemented today).
-- ---------------------------------------------------------------------------
create table if not exists public.historical_boqs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  source_type text not null check (source_type in ('excel', 'pdf', 'word')),
  original_filename text not null,
  storage_path text not null,
  file_size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.historical_boqs enable row level security;

create policy "Organisation members can manage their historical BOQs"
  on public.historical_boqs for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists historical_boqs_project_id_idx on public.historical_boqs (project_id);
create index if not exists historical_boqs_organisation_id_idx on public.historical_boqs (organisation_id);

-- ---------------------------------------------------------------------------
-- Historical BOQ Processing Jobs: tracks one deterministic parse-and-extract
-- run per historical BOQ. Deliberately a separate status vocabulary from
-- processing_jobs (which models the paid AI pricing pipeline) — this job
-- only ever parses, validates, and stores rows.
-- ---------------------------------------------------------------------------
create table if not exists public.historical_boq_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number bigserial unique,
  historical_boq_id uuid not null unique references public.historical_boqs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'UPLOADED' check (status in (
    'UPLOADED', 'PARSING', 'VALIDATING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'
  )),
  rows_detected integer not null default 0,
  rows_extracted integer not null default 0,
  rows_needs_review integer not null default 0,
  rows_error integer not null default 0,
  error_summary jsonb,
  failure_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.historical_boq_processing_jobs enable row level security;

create policy "Organisation members can manage their historical BOQ jobs"
  on public.historical_boq_processing_jobs for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = historical_boq_processing_jobs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = historical_boq_processing_jobs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists historical_boq_processing_jobs_project_id_idx
  on public.historical_boq_processing_jobs (project_id);

-- ---------------------------------------------------------------------------
-- Historical BOQ Items: every extracted line item, individually stored.
-- Designed for millions of rows — organisation_id, project_id, uploaded_at,
-- and section are denormalised from the parent historical_boqs row onto
-- every item so the library's filters never need a join at query time.
-- ---------------------------------------------------------------------------
create table if not exists public.historical_boq_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  historical_boq_id uuid not null references public.historical_boqs (id) on delete cascade,
  uploaded_at timestamptz not null,
  row_number integer not null,
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
  created_at timestamptz not null default now(),
  description_search tsvector generated always as (to_tsvector('english', description)) stored
);

alter table public.historical_boq_items enable row level security;

create policy "Organisation members can manage their historical BOQ items"
  on public.historical_boq_items for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists historical_boq_items_org_project_idx
  on public.historical_boq_items (organisation_id, project_id);
create index if not exists historical_boq_items_historical_boq_id_idx
  on public.historical_boq_items (historical_boq_id);
create index if not exists historical_boq_items_section_idx on public.historical_boq_items (section);
create index if not exists historical_boq_items_unit_idx on public.historical_boq_items (unit);
create index if not exists historical_boq_items_category_idx on public.historical_boq_items (category);
create index if not exists historical_boq_items_status_idx on public.historical_boq_items (status);
create index if not exists historical_boq_items_uploaded_at_idx on public.historical_boq_items (uploaded_at);
create index if not exists historical_boq_items_description_search_idx
  on public.historical_boq_items using gin (description_search);

-- ---------------------------------------------------------------------------
-- Filter-option lookups for the library UI. Plain `security invoker` SQL
-- functions (not `security definer`) so the existing RLS policy on
-- historical_boq_items still scopes results to the caller's organisation —
-- these exist only to get a real index-backed DISTINCT instead of the
-- application sampling rows and de-duplicating client-side, which would
-- silently miss values once the table holds millions of rows.
-- ---------------------------------------------------------------------------
create or replace function public.list_historical_boq_sections()
returns setof text
language sql
stable
as $$
  select distinct section from public.historical_boq_items where section is not null order by section;
$$;

create or replace function public.list_historical_boq_units()
returns setof text
language sql
stable
as $$
  select distinct unit from public.historical_boq_items where unit is not null order by unit;
$$;

create or replace function public.list_historical_boq_categories()
returns setof text
language sql
stable
as $$
  select distinct category from public.historical_boq_items where category is not null order by category;
$$;

grant execute on function public.list_historical_boq_sections() to authenticated;
grant execute on function public.list_historical_boq_units() to authenticated;
grant execute on function public.list_historical_boq_categories() to authenticated;
