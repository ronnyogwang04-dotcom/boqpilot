-- Historical BOQs become a reusable ORGANISATION-level library instead of
-- project-owned data. rate_library_items (canonical items, migration 6) and
-- the embeddings/benchmarking pipeline are already 100% organisation-scoped
-- with no project dimension at all — the only thing forcing per-project
-- ownership was a required project_id column plus application-layer
-- validation. This migration relaxes that column to optional "source
-- project" metadata across all three historical tables, without touching
-- organisation-level RLS (which already isolates tenants correctly).

-- ---------------------------------------------------------------------------
-- historical_boqs: project_id becomes optional metadata. Deleting a project
-- must not delete organisation-owned historical evidence, so the FK changes
-- from CASCADE to SET NULL.
-- ---------------------------------------------------------------------------
alter table public.historical_boqs
  alter column project_id drop not null;

alter table public.historical_boqs
  drop constraint historical_boqs_project_id_fkey;

alter table public.historical_boqs
  add constraint historical_boqs_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- historical_boq_items: same treatment. RLS here is already a direct
-- organisation_id check, so it is unaffected by project_id becoming null.
-- ---------------------------------------------------------------------------
alter table public.historical_boq_items
  alter column project_id drop not null;

alter table public.historical_boq_items
  drop constraint historical_boq_items_project_id_fkey;

alter table public.historical_boq_items
  add constraint historical_boq_items_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- historical_boq_processing_jobs: this table has NO organisation_id column
-- today — its RLS policy joins through project_id -> projects.organisation_id.
-- Making project_id nullable would silently deny access to any job whose
-- historical BOQ has no project, so add a direct organisation_id column,
-- backfill it, and switch the RLS policy to match the other two tables.
-- ---------------------------------------------------------------------------
alter table public.historical_boq_processing_jobs
  add column organisation_id uuid references public.organisations (id) on delete cascade;

update public.historical_boq_processing_jobs j
set organisation_id = hb.organisation_id
from public.historical_boqs hb
where j.historical_boq_id = hb.id
  and j.organisation_id is null;

alter table public.historical_boq_processing_jobs
  alter column organisation_id set not null;

alter table public.historical_boq_processing_jobs
  alter column project_id drop not null;

alter table public.historical_boq_processing_jobs
  drop constraint historical_boq_processing_jobs_project_id_fkey;

alter table public.historical_boq_processing_jobs
  add constraint historical_boq_processing_jobs_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

create index if not exists historical_boq_processing_jobs_organisation_id_idx
  on public.historical_boq_processing_jobs (organisation_id);

drop policy "Organisation members can manage their historical BOQ jobs"
  on public.historical_boq_processing_jobs;

create policy "Organisation members can manage their historical BOQ jobs"
  on public.historical_boq_processing_jobs for all
  using (organisation_id = public.current_organisation_id())
  with check (organisation_id = public.current_organisation_id());
