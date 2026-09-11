import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { normaliseDescription } from "@/lib/construction-intelligence/normalise-description";
import { normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import { classifyHierarchical } from "@/lib/construction-intelligence/category-hierarchy";
import { UNCATEGORISED } from "@/lib/historical-boq/categoriser";
import { buildEmbeddingInputText } from "./build-input-text";
import { createEmbeddings, isEmbeddingConfigured } from "./openai-client";
import { parseStoredEmbedding } from "./parse-embedding";
import { cosineSimilarity } from "./cosine-similarity";
import { scoreCandidate } from "./rank-candidate";

export type SemanticSearchCandidate = {
  id: string;
  normalisedDescription: string | null;
  normalisedUnit: string | null;
  division: string | null;
  category: string | null;
  embedding: number[];
  sampleCount: number;
  projectCount: number;
  avgRate: number | null;
  medianRate: number | null;
  minRate: number | null;
  maxRate: number | null;
  stddevRate: number | null;
  mostRecentRate: number | null;
  mostRecentRateAt: string | null;
};

/**
 * Narrow port, same rationale as EmbeddingRepository in backfill.ts — keeps
 * the ranking/query logic testable with an in-memory fake instead of
 * mocking Supabase's chainable builder.
 */
export type SemanticSearchRepository = {
  fetchEmbeddedCandidates(organisationId: string): Promise<SemanticSearchCandidate[]>;
};

const PAGE_SIZE = 1000;

export function createSupabaseSemanticSearchRepository(supabase: SupabaseClient<Database>): SemanticSearchRepository {
  return {
    async fetchEmbeddedCandidates(organisationId) {
      const all: SemanticSearchCandidate[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("rate_library_items")
          .select(
            "id, normalised_description, normalised_unit, category_division, construction_category, embedding, sample_count, project_count, avg_rate, median_rate, min_rate, max_rate, stddev_rate, most_recent_rate, most_recent_rate_at",
          )
          .eq("organisation_id", organisationId)
          .is("merged_into_id", null)
          .gt("sample_count", 0)
          .not("embedding", "is", null)
          .order("id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        for (const row of data) {
          const embedding = parseStoredEmbedding(row.embedding);
          // Skip rather than throw — a single unparsable vector shouldn't
          // take down the whole search over an otherwise-healthy library.
          if (!embedding) continue;
          all.push({
            id: row.id,
            normalisedDescription: row.normalised_description,
            normalisedUnit: row.normalised_unit,
            division: row.category_division,
            category: row.construction_category,
            embedding,
            sampleCount: row.sample_count,
            projectCount: row.project_count,
            avgRate: row.avg_rate,
            medianRate: row.median_rate,
            minRate: row.min_rate,
            maxRate: row.max_rate,
            stddevRate: row.stddev_rate,
            mostRecentRate: row.most_recent_rate,
            mostRecentRateAt: row.most_recent_rate_at,
          });
        }
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
  };
}

export type SemanticSearchQuery = {
  description: string;
  /** Optional admin-provided unit hint, e.g. "m2", "no" — normalised the same way as stored items. */
  unitHint?: string | null;
};

export type SemanticSearchResult = {
  id: string;
  description: string | null;
  unit: string | null;
  division: string | null;
  category: string | null;
  similarity: number;
  score: number;
  sampleCount: number;
  projectCount: number;
  avgRate: number | null;
  medianRate: number | null;
  minRate: number | null;
  maxRate: number | null;
  stddevRate: number | null;
  mostRecentRate: number | null;
  mostRecentRateAt: string | null;
};

export type SemanticSearchSuccess = {
  results: SemanticSearchResult[];
  /** What the free-text query was auto-classified as, for transparency in the admin UI. */
  inferredCategory: string | null;
  inferredUnit: string | null;
};

/**
 * Ranks already-embedded candidates against one query embedding, combining
 * raw vector similarity with unit/category context (see rank-candidate.ts)
 * rather than trusting the embedding model alone. Pulled out of
 * searchSimilarItems so semantic-search-batch.ts can rank many queries
 * against one fetched candidate pool without duplicating this logic.
 */
export function rankCandidates(
  queryEmbedding: number[],
  candidates: SemanticSearchCandidate[],
  unitHint: string | null,
  categoryForBoost: string | null,
  limit: number,
): SemanticSearchResult[] {
  return candidates
    .map((candidate) => {
      const similarity = cosineSimilarity(queryEmbedding, candidate.embedding);
      const score = scoreCandidate(
        similarity,
        { normalisedUnit: candidate.normalisedUnit, category: candidate.category },
        { unitHint, category: categoryForBoost },
      );
      return { candidate, similarity, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(
      ({ candidate, similarity, score }): SemanticSearchResult => ({
        id: candidate.id,
        description: candidate.normalisedDescription,
        unit: candidate.normalisedUnit,
        division: candidate.division,
        category: candidate.category,
        similarity,
        score,
        sampleCount: candidate.sampleCount,
        projectCount: candidate.projectCount,
        avgRate: candidate.avgRate,
        medianRate: candidate.medianRate,
        minRate: candidate.minRate,
        maxRate: candidate.maxRate,
        stddevRate: candidate.stddevRate,
        mostRecentRate: candidate.mostRecentRate,
        mostRecentRateAt: candidate.mostRecentRateAt,
      }),
    );
}

/**
 * Routes free text through the same deterministic normalisation the corpus
 * itself was embedded from (e.g. "reinf conc slab" -> "Reinforced concrete
 * slab") and infers a category to boost on. Shared by the single-item and
 * batch search paths so they classify a query identically.
 */
export function normaliseQueryForSearch(description: string, unitHint?: string | null): { normalisedQuery: string; unitHint: string | null; categoryForBoost: string | null; queryInputText: string } {
  const normalisedUnitHint = normaliseUnit(unitHint ?? null);
  const normalisedQuery = normaliseDescription(description);
  const { category } = classifyHierarchical(normalisedQuery, null);
  const categoryForBoost = category === UNCATEGORISED ? null : category;

  const queryInputText = buildEmbeddingInputText({
    normalisedDescription: normalisedQuery,
    normalisedUnit: normalisedUnitHint,
    division: null,
    category: categoryForBoost,
  });

  return { normalisedQuery, unitHint: normalisedUnitHint, categoryForBoost, queryInputText };
}

/**
 * Embeds the query text (one live OpenAI call) and ranks every already-
 * embedded eligible canonical item against it. Read-only: never writes to
 * rate_library_items, never merges or alters any canonical item.
 */
export async function searchSimilarItems(
  repo: SemanticSearchRepository,
  organisationId: string,
  query: SemanticSearchQuery,
  options: { limit?: number } = {},
): Promise<SemanticSearchSuccess> {
  if (!isEmbeddingConfigured()) {
    throw new Error("OPENAI_API_KEY is not set — cannot run semantic search.");
  }

  const description = query.description.trim();
  if (!description) return { results: [], inferredCategory: null, inferredUnit: null };

  const limit = options.limit ?? 15;
  const { unitHint, categoryForBoost, queryInputText } = normaliseQueryForSearch(description, query.unitHint);

  const [queryEmbedding] = await createEmbeddings([queryInputText]);
  const candidates = await repo.fetchEmbeddedCandidates(organisationId);
  const ranked = rankCandidates(queryEmbedding, candidates, unitHint, categoryForBoost, limit);

  return { results: ranked, inferredCategory: categoryForBoost, inferredUnit: unitHint };
}
