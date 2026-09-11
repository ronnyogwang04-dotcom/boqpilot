import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { embeddingConfig } from "@/config/embeddings";
import { buildEmbeddingInputText } from "./build-input-text";
import { chunkArray } from "./chunk";
import { classifyEmbeddingStatus, isEligibleForEmbedding, needsEmbedding, type EmbeddingStatus } from "./eligibility";
import { createEmbeddings, isEmbeddingConfigured } from "./openai-client";
import { withRetry } from "./retry";

export type EmbeddingCandidateRow = {
  id: string;
  normalisedDescription: string | null;
  normalisedUnit: string | null;
  division: string | null;
  category: string | null;
  embedding: number[] | null;
  embeddingInputText: string | null;
  embeddingLastError: string | null;
  mergedIntoId: string | null;
  sampleCount: number;
};

export type EmbeddingSaveResult = {
  embedding: number[] | null;
  inputText: string;
  model: string | null;
  error: string | null;
};

/**
 * Narrow port the orchestration logic below depends on, instead of a raw
 * SupabaseClient — makes runEmbeddingBackfill/getEmbeddingWorkload testable
 * with a trivial in-memory fake rather than mocking Supabase's chainable
 * query builder. createSupabaseEmbeddingRepository() below is the real
 * implementation used in production.
 */
export type EmbeddingRepository = {
  fetchAllEligible(organisationId: string): Promise<EmbeddingCandidateRow[]>;
  saveEmbeddingResult(id: string, result: EmbeddingSaveResult): Promise<void>;
};

const PAGE_SIZE = 1000;

export function createSupabaseEmbeddingRepository(supabase: SupabaseClient<Database>): EmbeddingRepository {
  return {
    async fetchAllEligible(organisationId) {
      const all: EmbeddingCandidateRow[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("rate_library_items")
          .select(
            "id, normalised_description, normalised_unit, category_division, construction_category, embedding, embedding_input_text, embedding_last_error, merged_into_id, sample_count",
          )
          .eq("organisation_id", organisationId)
          .is("merged_into_id", null)
          .gt("sample_count", 0)
          .order("id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        all.push(
          ...data.map((row) => ({
            id: row.id,
            normalisedDescription: row.normalised_description,
            normalisedUnit: row.normalised_unit,
            division: row.category_division,
            category: row.construction_category,
            embedding: row.embedding,
            embeddingInputText: row.embedding_input_text,
            embeddingLastError: row.embedding_last_error,
            mergedIntoId: row.merged_into_id,
            sampleCount: row.sample_count,
          })),
        );
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },

    async saveEmbeddingResult(id, result) {
      // On failure (result.embedding is null), embedding_generated_at is
      // deliberately left out of the payload entirely — a failed attempt
      // must not overwrite the last time this row genuinely got embedded.
      const payload: Database["public"]["Tables"]["rate_library_items"]["Update"] = {
        embedding: result.embedding,
        embedding_input_text: result.inputText,
        embedding_model: result.model,
        embedding_last_error: result.error,
        updated_at: new Date().toISOString(),
      };
      if (result.embedding) {
        payload.embedding_generated_at = new Date().toISOString();
      }

      const { error } = await supabase.from("rate_library_items").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

function candidateInputText(item: EmbeddingCandidateRow): string {
  return buildEmbeddingInputText({
    normalisedDescription: item.normalisedDescription,
    normalisedUnit: item.normalisedUnit,
    division: item.division,
    category: item.category,
  });
}

export type WorkloadReport = {
  totalCanonicalItems: number;
  eligible: number;
  ineligible: number;
  byStatus: Record<EmbeddingStatus, number>;
  needsEmbeddingCount: number;
  estimatedBatches: number;
  estimatedTokens: number;
};

/** Read-only — never calls OpenAI. Safe to run with no API key configured. */
export async function getEmbeddingWorkload(repo: EmbeddingRepository, organisationId: string): Promise<WorkloadReport> {
  const all = await repo.fetchAllEligible(organisationId);
  // fetchAllEligible already applies merged_into_id/sample_count filtering
  // server-side, but re-checking with the shared predicate keeps this
  // report correct even against a repository that didn't pre-filter.
  const eligible = all.filter((item) => isEligibleForEmbedding(item));

  const byStatus: Record<EmbeddingStatus, number> = { pending: 0, current: 0, stale: 0, failed: 0 };
  let needsEmbeddingCount = 0;
  let estimatedChars = 0;

  for (const item of eligible) {
    const text = candidateInputText(item);
    const status = classifyEmbeddingStatus(item, text);
    byStatus[status]++;
    if (status !== "current") {
      needsEmbeddingCount++;
      estimatedChars += text.length;
    }
  }

  const estimatedTokens = Math.ceil(estimatedChars / embeddingConfig.approxCharsPerToken);

  return {
    totalCanonicalItems: all.length,
    eligible: eligible.length,
    ineligible: all.length - eligible.length,
    byStatus,
    needsEmbeddingCount,
    estimatedBatches: Math.ceil(needsEmbeddingCount / embeddingConfig.batchSize),
    estimatedTokens,
  };
}

export type EmbeddingInputPreview = { id: string; description: string | null; inputText: string; status: EmbeddingStatus };

/** Preview of what would actually be sent, with zero API calls — for admin review before spending anything. */
export async function previewEmbeddingInputs(
  repo: EmbeddingRepository,
  organisationId: string,
  limit: number,
): Promise<EmbeddingInputPreview[]> {
  const all = await repo.fetchAllEligible(organisationId);
  const eligible = all.filter((item) => isEligibleForEmbedding(item));

  const previews: EmbeddingInputPreview[] = [];
  for (const item of eligible) {
    const text = candidateInputText(item);
    const status = classifyEmbeddingStatus(item, text);
    if (status === "current") continue;
    previews.push({ id: item.id, description: item.normalisedDescription, inputText: text, status });
    if (previews.length >= limit) break;
  }
  return previews;
}

export type BackfillSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
  chunks: number;
  apiCalls: number;
};

export type BackfillOptions = {
  limit: number;
  batchSize?: number;
  onProgress?: (message: string) => void;
  /** Overrides embeddingConfig's retry defaults — mainly so tests don't wait through real backoff delays. */
  retry?: { maxRetries: number; baseDelayMs: number };
};

/**
 * Fetches up to `limit` eligible items still needing an embedding, embeds
 * them in chunks of `batchSize` (one OpenAI request per chunk), and writes
 * results back per-chunk as it goes — so a failure partway through leaves
 * real, usable progress rather than an all-or-nothing transaction. Because
 * "needs embedding" is re-evaluated from stored state on every call, a
 * second run against the same data with nothing changed does zero API
 * calls (idempotent) and re-running after a partial failure only retries
 * what's still outstanding (resumable) — no separate job-tracking table.
 */
export async function runEmbeddingBackfill(
  repo: EmbeddingRepository,
  organisationId: string,
  options: BackfillOptions,
): Promise<BackfillSummary> {
  if (!isEmbeddingConfigured()) {
    throw new Error("OPENAI_API_KEY is not set — cannot run the embedding backfill.");
  }

  const batchSize = options.batchSize ?? embeddingConfig.batchSize;
  const all = await repo.fetchAllEligible(organisationId);
  const eligible = all.filter((item) => isEligibleForEmbedding(item));

  const candidates = eligible
    .map((item) => ({ item, text: candidateInputText(item) }))
    .filter(({ item, text }) => needsEmbedding(item, text))
    .slice(0, options.limit);

  const chunks = chunkArray(candidates, batchSize);
  const summary: BackfillSummary = { attempted: candidates.length, succeeded: 0, failed: 0, chunks: chunks.length, apiCalls: 0 };
  const { maxRetries, baseDelayMs } = options.retry ?? {
    maxRetries: embeddingConfig.maxRetries,
    baseDelayMs: embeddingConfig.retryBaseDelayMs,
  };

  for (const [chunkIndex, chunk] of chunks.entries()) {
    options.onProgress?.(`Embedding chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} items)...`);

    try {
      const embeddings = await withRetry(() => createEmbeddings(chunk.map(({ text }) => text)), {
        maxRetries,
        baseDelayMs,
        onRetry: (attempt, error) =>
          options.onProgress?.(`  retry ${attempt}/${maxRetries} after error: ${errorMessage(error)}`),
      });
      summary.apiCalls++;

      for (let i = 0; i < chunk.length; i++) {
        const saved = await trySave(repo, chunk[i].item.id, {
          embedding: embeddings[i],
          inputText: chunk[i].text,
          model: embeddingConfig.model,
          error: null,
        });
        if (saved) summary.succeeded++;
        else options.onProgress?.(`  failed to persist embedding for item ${chunk[i].item.id} (will retry on next run)`);
      }
    } catch (error) {
      const message = errorMessage(error);
      options.onProgress?.(`  chunk ${chunkIndex + 1} failed after retries: ${message}`);
      for (const { item, text } of chunk) {
        const saved = await trySave(repo, item.id, { embedding: null, inputText: text, model: null, error: message });
        if (saved) summary.failed++;
        else options.onProgress?.(`  failed to persist failure state for item ${item.id} (will retry on next run)`);
      }
      // Continue to the next chunk rather than aborting the whole run —
      // one bad chunk shouldn't block every other item from embedding.
    }
  }

  return summary;
}

/**
 * The write-back to storage can itself fail transiently (e.g. a network
 * blip on the Supabase call), independent of whether the OpenAI call
 * succeeded. That must not crash the whole backfill — a run is idempotent
 * and resumable, so an item whose save fails just stays "pending" (or keeps
 * its prior state) and gets picked up again on the next invocation.
 */
async function trySave(repo: EmbeddingRepository, id: string, result: EmbeddingSaveResult): Promise<boolean> {
  try {
    await repo.saveEmbeddingResult(id, result);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
