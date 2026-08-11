-- Construction Intelligence Layer: deterministic normalisation, duplicate
-- detection, hierarchical categorisation, and precomputed rate statistics
-- sitting between raw extraction (historical_boq_items) and the future
-- AI/embedding phase. rate_library_items has been schema-only groundwork
-- since migration 4, explicitly earmarked as "ready for normalised line
-- items keyed to the organisation" — this migration is what actually
-- populates it, deterministically. `embedding` and `ai_confidence` are left
-- untouched and unused; the future embedding service reads
-- `normalised_description` off these same rows, no further schema change
-- needed then.

-- ---------------------------------------------------------------------------
-- Link every raw line item to the canonical item it was deduplicated into.
-- Every item gets linked, including `needs_review` ones (duplicate detection
-- is about description/unit identity, not rate presence) — only rows with a
-- non-null unit_rate ever feed the numeric stats below.
-- ---------------------------------------------------------------------------
alter table public.historical_boq_items
  add column if not exists canonical_item_id uuid references public.rate_library_items (id) on delete set null;

create index if not exists historical_boq_items_canonical_item_id_idx
  on public.historical_boq_items (canonical_item_id);

-- ---------------------------------------------------------------------------
-- rate_library_items: additive columns only. source_boq_id / original_description
-- / historical_stats / embedding / ai_confidence (migration 4) are untouched
-- and still unused.
-- ---------------------------------------------------------------------------
alter table public.rate_library_items
  add column if not exists category_division text,
  add column if not exists duplicate_group_key text,
  add column if not exists sample_count integer not null default 0,
  add column if not exists project_count integer not null default 0,
  add column if not exists avg_rate numeric,
  add column if not exists median_rate numeric,
  add column if not exists min_rate numeric,
  add column if not exists max_rate numeric,
  add column if not exists stddev_rate numeric,
  add column if not exists most_recent_rate numeric,
  add column if not exists most_recent_rate_at timestamptz,
  add column if not exists most_recent_historical_boq_id uuid references public.historical_boqs (id) on delete set null,
  add column if not exists normalised_description_search tsvector
    generated always as (to_tsvector('english', coalesce(normalised_description, ''))) stored;

-- Two raw items are the same canonical item iff they share a duplicate_group_key
-- within an organisation (see src/lib/construction-intelligence/duplicate-key.ts).
create unique index if not exists rate_library_items_org_dup_key_idx
  on public.rate_library_items (organisation_id, duplicate_group_key);

create index if not exists rate_library_items_category_division_idx on public.rate_library_items (category_division);
create index if not exists rate_library_items_construction_category_idx on public.rate_library_items (construction_category);
create index if not exists rate_library_items_normalised_unit_idx on public.rate_library_items (normalised_unit);
create index if not exists rate_library_items_avg_rate_idx on public.rate_library_items (avg_rate);
create index if not exists rate_library_items_normalised_description_search_idx
  on public.rate_library_items using gin (normalised_description_search);

-- ---------------------------------------------------------------------------
-- Recomputes sample_count/project_count/avg/median/min/max/stddev/most-recent
-- for a specific set of canonical items — called with only the (small) set
-- touched by one upload, never the whole table, so this stays cheap
-- regardless of how large historical_boq_items grows. `security invoker`
-- (the default — no `security definer` here) so RLS on both tables still
-- scopes everything to the caller's organisation.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_rate_library_stats(p_canonical_ids uuid[])
returns void
language plpgsql
as $$
begin
  with stats as (
    select
      canonical_item_id,
      count(*) as sample_count,
      count(distinct project_id) as project_count,
      avg(unit_rate) as avg_rate,
      percentile_cont(0.5) within group (order by unit_rate) as median_rate,
      min(unit_rate) as min_rate,
      max(unit_rate) as max_rate,
      stddev_samp(unit_rate) as stddev_rate
    from public.historical_boq_items
    where canonical_item_id = any (p_canonical_ids)
      and unit_rate is not null
    group by canonical_item_id
  ),
  recent as (
    select distinct on (canonical_item_id)
      canonical_item_id,
      unit_rate as most_recent_rate,
      uploaded_at as most_recent_rate_at,
      historical_boq_id as most_recent_historical_boq_id
    from public.historical_boq_items
    where canonical_item_id = any (p_canonical_ids)
      and unit_rate is not null
    order by canonical_item_id, uploaded_at desc, created_at desc
  )
  update public.rate_library_items r
  set
    sample_count = stats.sample_count,
    project_count = stats.project_count,
    avg_rate = stats.avg_rate,
    median_rate = stats.median_rate,
    min_rate = stats.min_rate,
    max_rate = stats.max_rate,
    stddev_rate = stats.stddev_rate,
    most_recent_rate = recent.most_recent_rate,
    most_recent_rate_at = recent.most_recent_rate_at,
    most_recent_historical_boq_id = recent.most_recent_historical_boq_id,
    updated_at = now()
  from stats
  left join recent on recent.canonical_item_id = stats.canonical_item_id
  where r.id = stats.canonical_item_id;
end;
$$;

grant execute on function public.recompute_rate_library_stats(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Rate Explorer filter-option lookups — same rationale as the
-- list_historical_boq_* functions in migration 5: a real index-backed
-- DISTINCT instead of sampling rows client-side.
-- ---------------------------------------------------------------------------
create or replace function public.list_rate_library_divisions()
returns setof text
language sql
stable
as $$
  select distinct category_division from public.rate_library_items where category_division is not null order by category_division;
$$;

create or replace function public.list_rate_library_categories()
returns setof text
language sql
stable
as $$
  select distinct construction_category from public.rate_library_items where construction_category is not null order by construction_category;
$$;

create or replace function public.list_rate_library_units()
returns setof text
language sql
stable
as $$
  select distinct normalised_unit from public.rate_library_items where normalised_unit is not null order by normalised_unit;
$$;

grant execute on function public.list_rate_library_divisions() to authenticated;
grant execute on function public.list_rate_library_categories() to authenticated;
grant execute on function public.list_rate_library_units() to authenticated;
