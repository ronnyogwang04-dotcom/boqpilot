-- Canonical Item Manager: lets an admin correct and merge rate_library_items
-- rows that the deterministic normalisation engine (migration 6) got wrong
-- or under-merged. merged_into_id lets two canonical items with genuinely
-- different duplicate_group_keys (the unique index can't catch this — the
-- keys differ) be consolidated by a human without deleting the source row,
-- so historical_boq_items and any audit trail pointing at it stay intact.

alter table public.rate_library_items
  add column if not exists merged_into_id uuid references public.rate_library_items (id) on delete set null,
  add column if not exists admin_notes text;

create index if not exists rate_library_items_merged_into_id_idx on public.rate_library_items (merged_into_id);

-- Merged-away rows should disappear from the filter-option lookups used by
-- Rate Explorer and the Canonical Item Manager, but stay in the table.
create or replace function public.list_rate_library_divisions()
returns setof text
language sql
stable
as $$
  select distinct category_division from public.rate_library_items
  where category_division is not null and merged_into_id is null
  order by category_division;
$$;

create or replace function public.list_rate_library_categories()
returns setof text
language sql
stable
as $$
  select distinct construction_category from public.rate_library_items
  where construction_category is not null and merged_into_id is null
  order by construction_category;
$$;

create or replace function public.list_rate_library_units()
returns setof text
language sql
stable
as $$
  select distinct normalised_unit from public.rate_library_items
  where normalised_unit is not null and merged_into_id is null
  order by normalised_unit;
$$;
