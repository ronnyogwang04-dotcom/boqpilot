-- Phase 6 hardening pass — fixes three issues found in live validation:
--   1. South African source discipline: evidence now carries a detected
--      source_origin so international sources can be labelled and excluded
--      from the default comparable set (see market-research/source-origin.ts).
--   2. Zero/non-price sources: market_evidence.source_price was already
--      nullable (no schema change needed there) — the fix is entirely in
--      application code (never write 0 for an unpublished price).
--   3. Spec/SKU comparability: market_research_runs now stores a
--      comparability_note explaining when a baseline could not be safely
--      computed (e.g. fragmented across different specifications), so a
--      cached/reloaded run shows the same honesty as a fresh one.
-- Purely additive — no existing column, table, or historical-library data
-- is touched.

alter table public.market_evidence
  add column if not exists source_origin text not null default 'unknown'
    check (source_origin in ('south_africa', 'international', 'unknown'));

comment on column public.market_evidence.source_origin is
  'Deterministically detected from domain/content (never model self-report) — south_africa, international, or unknown. International sources are excluded from the default comparable market set unless no South African/unknown-origin evidence exists at all.';

alter table public.market_research_runs
  add column if not exists comparability_note text;

comment on column public.market_research_runs.comparability_note is
  'Set when the observed range/representative baseline could not be (fully) computed and why — e.g. insufficient exact/equivalent sources, or evidence fragmented across different specifications. Never silently blended into a number.';
