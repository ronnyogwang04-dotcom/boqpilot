import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { describeSimilarity } from "@/lib/construction-intelligence/similarity";
import { buildEmbeddingInputText } from "@/lib/embeddings/build-input-text";
import { classifyEmbeddingStatus, type EmbeddingStatus } from "@/lib/embeddings/eligibility";

export const CANONICAL_ITEMS_PAGE_SIZE = 50;
const DUPLICATE_CANDIDATE_LIMIT = 200;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.4;
const MAX_SUGGESTED_DUPLICATES = 5;

export type CanonicalItemFilters = {
  division?: string;
  category?: string;
  unit?: string;
  description?: string;
  singletonOnly?: boolean;
};

const LIST_COLUMNS =
  "id, normalised_description, normalised_unit, category_division, construction_category, sample_count, project_count, avg_rate, admin_notes, created_at, embedding_input_text, embedding_model, embedding_generated_at, embedding_last_error";

export type CanonicalItemListRow = {
  id: string;
  normalised_description: string | null;
  normalised_unit: string | null;
  category_division: string | null;
  construction_category: string | null;
  sample_count: number;
  project_count: number;
  avg_rate: number | null;
  admin_notes: string | null;
  created_at: string;
  embedding_input_text: string | null;
  embedding_model: string | null;
  embedding_generated_at: string | null;
  embedding_last_error: string | null;
  embeddingStatus: EmbeddingStatus;
};

// embedding_generated_at (not the 1536-float `embedding` column itself) is
// used as the "has an embedding" signal here — the save path in
// backfill.ts sets one if and only if it sets the other, and pulling the
// full vector into every list/detail query would be a lot of payload for a
// value nothing in the UI actually renders.
function computeEmbeddingStatus(item: {
  normalised_description: string | null;
  normalised_unit: string | null;
  category_division: string | null;
  construction_category: string | null;
  embedding_input_text: string | null;
  embedding_generated_at: string | null;
  embedding_last_error: string | null;
}): EmbeddingStatus {
  const candidateText = buildEmbeddingInputText({
    normalisedDescription: item.normalised_description,
    normalisedUnit: item.normalised_unit,
    division: item.category_division,
    category: item.construction_category,
  });
  return classifyEmbeddingStatus(
    {
      embedding: item.embedding_generated_at,
      embeddingInputText: item.embedding_input_text,
      embeddingLastError: item.embedding_last_error,
    },
    candidateText,
  );
}

/**
 * Admin listing of canonical items — unlike listRateLibraryItems() (Rate
 * Explorer), this deliberately does NOT require sample_count > 0: an admin
 * needs to see and correct every canonical row the normalisation engine
 * created, including ones with no priced source item yet.
 */
export async function listCanonicalItems(filters: CanonicalItemFilters, page: number) {
  const supabase = await createClient();
  const safePage = Math.max(1, page);

  let query = supabase
    .from("rate_library_items")
    .select(LIST_COLUMNS, { count: "estimated" })
    .is("merged_into_id", null)
    .order("created_at", { ascending: false })
    .order("id");

  if (filters.division) query = query.eq("category_division", filters.division);
  if (filters.category) query = query.eq("construction_category", filters.category);
  if (filters.unit) query = query.eq("normalised_unit", filters.unit);
  if (filters.singletonOnly) query = query.eq("sample_count", 1);
  if (filters.description?.trim()) {
    query = query.textSearch("normalised_description_search", filters.description.trim(), {
      type: "websearch",
      config: "english",
    });
  }

  const from = (safePage - 1) * CANONICAL_ITEMS_PAGE_SIZE;
  const to = from + CANONICAL_ITEMS_PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listCanonicalItems failed:", error.message);
    return { items: [] as CanonicalItemListRow[], count: 0, page: safePage, pageSize: CANONICAL_ITEMS_PAGE_SIZE };
  }

  const items = (data ?? []).map((item) => ({ ...item, embeddingStatus: computeEmbeddingStatus(item) }));
  return { items, count: count ?? 0, page: safePage, pageSize: CANONICAL_ITEMS_PAGE_SIZE };
}

export type CanonicalItemDetail = {
  id: string;
  organisation_id: string;
  normalised_description: string | null;
  normalised_unit: string | null;
  category_division: string | null;
  construction_category: string | null;
  admin_notes: string | null;
  merged_into_id: string | null;
  sample_count: number;
  project_count: number;
  avg_rate: number | null;
  median_rate: number | null;
  min_rate: number | null;
  max_rate: number | null;
  stddev_rate: number | null;
  most_recent_rate: number | null;
  most_recent_rate_at: string | null;
  embedding_input_text: string | null;
  embedding_model: string | null;
  embedding_generated_at: string | null;
  embedding_last_error: string | null;
  embeddingStatus: EmbeddingStatus;
};

const DETAIL_COLUMNS =
  "id, organisation_id, normalised_description, normalised_unit, category_division, construction_category, admin_notes, merged_into_id, sample_count, project_count, avg_rate, median_rate, min_rate, max_rate, stddev_rate, most_recent_rate, most_recent_rate_at, embedding_input_text, embedding_model, embedding_generated_at, embedding_last_error";

export async function getCanonicalItem(id: string): Promise<CanonicalItemDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rate_library_items").select(DETAIL_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  return { ...data, embeddingStatus: computeEmbeddingStatus(data) };
}

export type PossibleDuplicate = {
  id: string;
  normalised_description: string | null;
  normalised_unit: string | null;
  sample_count: number;
  similarity: number;
};

/**
 * Suggests other canonical items in the same organisation that might be the
 * same real-world item under different wording — a human decides whether to
 * merge, this never merges anything itself (see similarity.ts). Bounded to
 * a candidate pool sharing the same division or unit, since scoring the
 * whole table for every detail-page view wouldn't scale.
 */
export async function listPossibleDuplicates(
  supabase: SupabaseClient<Database>,
  item: CanonicalItemDetail,
): Promise<PossibleDuplicate[]> {
  if (!item.normalised_description) return [];

  let query = supabase
    .from("rate_library_items")
    .select("id, normalised_description, normalised_unit, sample_count")
    .eq("organisation_id", item.organisation_id)
    .neq("id", item.id)
    .is("merged_into_id", null)
    .limit(DUPLICATE_CANDIDATE_LIMIT);

  if (item.category_division) {
    query = query.eq("category_division", item.category_division);
  } else if (item.normalised_unit) {
    query = query.eq("normalised_unit", item.normalised_unit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .map((candidate) => ({
      id: candidate.id,
      normalised_description: candidate.normalised_description,
      normalised_unit: candidate.normalised_unit,
      sample_count: candidate.sample_count,
      similarity: describeSimilarity(item.normalised_description!, candidate.normalised_description ?? ""),
    }))
    .filter((candidate) => candidate.similarity >= DUPLICATE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_SUGGESTED_DUPLICATES);
}
