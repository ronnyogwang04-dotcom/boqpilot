"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createSupabaseSemanticSearchRepository,
  searchSimilarItems,
  type SemanticSearchResult,
} from "@/lib/embeddings/semantic-search";
import { isEmbeddingConfigured } from "@/lib/embeddings/openai-client";
import type { ActionState } from "@/types/action-state";

export type SemanticSearchActionState = ActionState & {
  results?: SemanticSearchResult[];
  inferredCategory?: string | null;
  inferredUnit?: string | null;
};

const RESULT_LIMIT = 15;

/**
 * Admin-only, read-only exploration tool: embeds the free-text query (one
 * live OpenAI call) and ranks it against the already-embedded canonical
 * item library. Never merges, alters, or creates any rate_library_items
 * row, and never touches the pricing BOQ workflow — this is a standalone
 * testing surface for Phase 4 semantic search validation.
 */
export async function searchSimilarCanonicalItems(
  _prevState: SemanticSearchActionState,
  formData: FormData,
): Promise<SemanticSearchActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You must be an admin to do that." };
  }

  if (!isEmbeddingConfigured()) {
    return {
      status: "error",
      message: "OPENAI_API_KEY isn't configured yet — semantic search needs a live call to embed the query text.",
    };
  }

  const description = String(formData.get("description") ?? "").trim();
  if (!description) {
    return { status: "error", message: "Enter a description to search for." };
  }

  const unitHint = String(formData.get("unit") ?? "").trim() || null;
  const repo = createSupabaseSemanticSearchRepository(admin.supabase);

  try {
    const { results, inferredCategory, inferredUnit } = await searchSimilarItems(
      repo,
      admin.organisationId,
      { description, unitHint },
      { limit: RESULT_LIMIT },
    );

    return {
      status: "success",
      message: results.length === 0 ? "No embedded canonical items to compare against yet." : `${results.length} match${results.length === 1 ? "" : "es"} found.`,
      results,
      inferredCategory,
      inferredUnit,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Semantic search failed." };
  }
}
