-- Enterprise foundation: Organisation -> Projects -> Project Versions -> BOQs
-- -> Processing Jobs, plus an append-only audit log, per-project timeline,
-- and schema-only groundwork for Pricing Runs, Exports, and the Construction
-- Rate Engine (no AI logic implemented — this is plumbing only).

-- ---------------------------------------------------------------------------
-- Organisations (1:1 with a user for now — every profile gets exactly one on
-- sign-up. Data is scoped to organisation_id everywhere so multi-seat orgs
-- are a follow-up feature, not a redesign.)
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists organisation_id uuid references public.organisations (id) on delete restrict,
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- Backfill an organisation for any profile that predates this migration.
do $$
declare
  r record;
  new_org_id uuid;
begin
  for r in select id, full_name from public.profiles where organisation_id is null loop
    insert into public.organisations (name) values (coalesce(r.full_name, 'My Organisation'))
      returning id into new_org_id;
    update public.profiles set organisation_id = new_org_id where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column organisation_id set not null;

alter table public.organisations enable row level security;

create policy "Users can view their own organisation"
  on public.organisations for select
  using (id = (select organisation_id from public.profiles where id = auth.uid()));

-- Every RLS policy below scopes to "same organisation as the caller" via this
-- helper, so policies stay short and consistent as more tables are added.
create or replace function public.current_organisation_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organisation_id from public.profiles where id = auth.uid()
$$;

-- Sign-up now provisions an organisation alongside the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organisations (name)
    values (coalesce(new.raw_user_meta_data ->> 'full_name', 'My Organisation'))
    returning id into new_org_id;

  insert into public.profiles (id, full_name, organisation_id)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new_org_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects: rich tender metadata, scoped to an organisation rather than a
-- single owner (so future multi-user orgs share projects with no migration).
-- ---------------------------------------------------------------------------
alter table public.projects rename column owner_id to created_by;

alter table public.projects
  add column if not exists organisation_id uuid references public.organisations (id) on delete restrict,
  add column if not exists project_number text,
  add column if not exists tender_number text,
  add column if not exists contract_number text,
  add column if not exists client_name text,
  add column if not exists contractor_name text,
  add column if not exists province text,
  add column if not exists municipality text,
  add column if not exists town text,
  add column if not exists physical_address text,
  add column if not exists sector text[] not null default '{}'
    check (sector <@ array['building', 'civil', 'electrical', 'mechanical']::text[]),
  add column if not exists estimated_contract_value numeric,
  add column if not exists tender_closing_date date,
  add column if not exists award_date date,
  add column if not exists notes text;

update public.projects p
  set organisation_id = pr.organisation_id
  from public.profiles pr
  where pr.id = p.created_by and p.organisation_id is null;

alter table public.projects alter column organisation_id set not null;

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('draft', 'active', 'submitted', 'won', 'lost', 'archived'));

drop policy if exists "Users can manage their own projects" on public.projects;
create policy "Organisation members can manage their projects"
  on public.projects for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists projects_organisation_id_idx on public.projects (organisation_id);

-- ---------------------------------------------------------------------------
-- Project Versions: one immutable row per BOQ upload event. Never updated —
-- a new upload always inserts a new version, never overwrites a prior one.
-- ---------------------------------------------------------------------------
create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version_number integer not null,
  version_label text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

alter table public.project_versions enable row level security;

create policy "Organisation members can view their project versions"
  on public.project_versions for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_versions.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create policy "Organisation members can create project versions"
  on public.project_versions for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_versions.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists project_versions_project_id_idx on public.project_versions (project_id);

-- ---------------------------------------------------------------------------
-- BOQs: the file-derived pricing decision for one Project Version. Lifecycle
-- status now lives entirely on processing_jobs (below) — a BOQ row itself
-- never needs to change once its pricing is decided.
-- ---------------------------------------------------------------------------
alter table public.boqs
  add column if not exists project_version_id uuid references public.project_versions (id) on delete set null,
  add column if not exists file_size_bytes bigint;

alter table public.boqs drop column if exists status;

drop policy if exists "Users can manage their own BOQs" on public.boqs;
create policy "Organisation members can manage their BOQs"
  on public.boqs for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = boqs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = boqs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists boqs_project_version_id_idx on public.boqs (project_version_id);

-- ---------------------------------------------------------------------------
-- Processing Jobs: the single source of truth for a BOQ's pipeline status.
-- Created at upload time; the app advances it through the payment-related
-- stages itself (no queue worker exists yet — a job simply parks at QUEUED).
-- ---------------------------------------------------------------------------
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number bigserial unique,
  boq_id uuid not null unique references public.boqs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'UPLOADED' check (status in (
    'UPLOADED', 'WAITING_FOR_PAYMENT', 'PAYMENT_VERIFIED', 'QUEUED',
    'PREPARING_DOCUMENT', 'AI_EXTRACTION', 'NORMALISING_DATA', 'BENCHMARKING',
    'RATE_RECOMMENDATION', 'GENERATING_EXPORT', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  progress smallint not null default 0 check (progress between 0 and 100),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  estimated_completion timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  retry_count smallint not null default 0,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.processing_jobs enable row level security;

create policy "Organisation members can manage their processing jobs"
  on public.processing_jobs for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = processing_jobs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = processing_jobs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists processing_jobs_project_id_idx on public.processing_jobs (project_id);

-- ---------------------------------------------------------------------------
-- Pricing Runs: schema-only groundwork for the future Pricing Engine output.
-- Nothing in the application creates rows here yet. Read-only once completed.
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_runs (
  id uuid primary key default gen_random_uuid(),
  run_number bigserial unique,
  project_id uuid not null references public.projects (id) on delete cascade,
  boq_id uuid not null references public.boqs (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  ai_recommendation jsonb,
  final_approved_rates jsonb,
  manual_changes jsonb,
  confidence_scores jsonb,
  benchmark_results jsonb,
  comments text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_completed_pricing_run_update()
returns trigger
language plpgsql
as $$
begin
  if old.completed_at is not null then
    raise exception 'Pricing run % is read-only after completion', old.id;
  end if;
  return new;
end;
$$;

create or replace trigger pricing_runs_immutable_after_completion
  before update on public.pricing_runs
  for each row execute function public.prevent_completed_pricing_run_update();

alter table public.pricing_runs enable row level security;

create policy "Organisation members can manage their pricing runs"
  on public.pricing_runs for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = pricing_runs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = pricing_runs.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists pricing_runs_project_id_idx on public.pricing_runs (project_id);

-- ---------------------------------------------------------------------------
-- Exports: schema-only groundwork. Nothing generates files yet.
-- ---------------------------------------------------------------------------
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  boq_id uuid not null references public.boqs (id) on delete cascade,
  pricing_run_id uuid references public.pricing_runs (id) on delete set null,
  export_type text not null check (export_type in ('excel', 'pdf')),
  file_path text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.exports enable row level security;

create policy "Organisation members can manage their exports"
  on public.exports for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = exports.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = exports.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists exports_project_id_idx on public.exports (project_id);

-- ---------------------------------------------------------------------------
-- Audit Log: append-only. No update/delete policy is defined for any role,
-- so RLS denies both by default — this table cannot be edited, only appended
-- to and read.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Organisation members can view their audit log"
  on public.audit_log for select
  using (organisation_id = public.current_organisation_id());

create policy "Organisation members can append to their audit log"
  on public.audit_log for insert
  with check (organisation_id = public.current_organisation_id());

create index if not exists audit_log_organisation_id_idx on public.audit_log (organisation_id);

-- ---------------------------------------------------------------------------
-- Project Timeline: user-facing milestone feed per project (distinct from
-- the audit log, which is a compliance/security trail).
-- ---------------------------------------------------------------------------
create table if not exists public.project_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'boq_uploaded', 'payment_received', 'processing_started',
    'ai_extraction_completed', 'benchmark_completed', 'pricing_completed', 'export_generated'
  )),
  event_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.project_timeline enable row level security;

create policy "Organisation members can view their project timeline"
  on public.project_timeline for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_timeline.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create policy "Organisation members can append to their project timeline"
  on public.project_timeline for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_timeline.project_id
      and projects.organisation_id = public.current_organisation_id()
    )
  );

create index if not exists project_timeline_project_id_idx on public.project_timeline (project_id);

-- ---------------------------------------------------------------------------
-- Construction Rate Engine: schema-only groundwork for future AI extraction
-- and benchmarking. Nothing in the application writes to this table yet.
-- ---------------------------------------------------------------------------
create extension if not exists vector;

create table if not exists public.rate_library_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  source_boq_id uuid references public.boqs (id) on delete set null,
  original_description text,
  normalised_description text,
  construction_category text,
  normalised_unit text,
  material_classification text,
  historical_stats jsonb,
  embedding vector(1536),
  ai_confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rate_library_items enable row level security;

create policy "Organisation members can manage their rate library"
  on public.rate_library_items for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());

create index if not exists rate_library_items_organisation_id_idx on public.rate_library_items (organisation_id);
