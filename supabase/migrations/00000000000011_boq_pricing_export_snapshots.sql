-- Phase 6: Excel pricing workbook export. Adds durable snapshots of the two
-- kinds of pricing evidence the estimator UI already computes but never
-- persisted — the historical benchmark match and the cost build-up
-- breakdown — so the export can show real, saved reasoning per item instead
-- of re-deriving it. Also adds a distinct, read-only "system suggested"
-- snapshot for items the estimator hasn't reviewed yet, populated only by
-- the export path and never treated as (or capable of becoming) the
-- estimator's own decision. Purely additive: no existing column, table,
-- historical-library data, normalised_description, or duplicate_group_key
-- is touched.

alter table public.boq_line_items
  add column if not exists cost_buildup_components jsonb,
  add column if not exists cost_buildup_markups jsonb,
  add column if not exists benchmark_snapshot jsonb,
  add column if not exists system_suggested_snapshot jsonb,
  add column if not exists system_suggested_at timestamptz;

comment on column public.boq_line_items.cost_buildup_components is
  'Snapshot of CostBuildupComponents (material/labour/plant/... costs), captured only when the estimator saves a decision with rate_source = build_up. Never set automatically.';
comment on column public.boq_line_items.cost_buildup_markups is
  'Snapshot of CostBuildupMarkups (overhead/contingency/profit percentages actually used for this item), captured alongside cost_buildup_components.';
comment on column public.boq_line_items.benchmark_snapshot is
  'Snapshot of the historical benchmark bestMatch (avg/median/min/max/most-recent rate, similarity, sample/project count, category, unit, confidence) the estimator was looking at when they saved a decision with rate_source = historical.';
comment on column public.boq_line_items.system_suggested_snapshot is
  'Read-only reference data: a historical benchmark computed by the export pipeline for a row with no estimator_rate yet, cached so repeat exports do not re-run the search. Never a decision, never surfaced as if the estimator confirmed it.';
comment on column public.boq_line_items.system_suggested_at is
  'When system_suggested_snapshot was computed, so the export can show it is a cached suggestion and not live evidence.';
