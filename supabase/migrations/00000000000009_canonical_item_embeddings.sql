-- Phase 3: OpenAI embeddings for canonical construction items. Additive
-- only — `embedding vector(1536)` and `ai_confidence` have existed since
-- migration 4 as schema-only groundwork ("the future embedding service
-- reads normalised_description off these same rows, no further schema
-- change needed then") and are reused unchanged here.
--
-- `normalised_description` and `duplicate_group_key` (migration 6) are
-- deliberately untouched by this migration and by everything that consumes
-- it — they remain the sole deterministic dedup key. What actually gets
-- embedded is `embedding_input_text`, a separate derived field built from
-- normalised_description + normalised_unit + category context (see
-- src/lib/embeddings/build-input-text.ts), so nothing about embeddings can
-- ever feed back into canonical-item identity/merging.

alter table public.rate_library_items
  add column if not exists embedding_input_text text,
  add column if not exists embedding_model text,
  add column if not exists embedding_generated_at timestamptz,
  add column if not exists embedding_last_error text;

-- Speeds up "find items still needing an embedding" queries (the dry-run
-- report and the backfill's own candidate selection) without needing a
-- separate status column — pending is simply `embedding is null`.
create index if not exists rate_library_items_embedding_pending_idx
  on public.rate_library_items (organisation_id)
  where embedding is null and merged_into_id is null;
