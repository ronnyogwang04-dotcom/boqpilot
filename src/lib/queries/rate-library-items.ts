import { createClient } from "@/lib/supabase/server";

export const RATE_EXPLORER_PAGE_SIZE = 50;

export type RateExplorerSort = "sample_count" | "avg_rate" | "description";

export type RateExplorerFilters = {
  division?: string;
  category?: string;
  unit?: string;
  description?: string;
  minSampleCount?: number;
};

export type RateLibraryItem = {
  id: string;
  normalised_description: string | null;
  normalised_unit: string | null;
  category_division: string | null;
  construction_category: string | null;
  sample_count: number;
  project_count: number;
  avg_rate: number | null;
  median_rate: number | null;
  min_rate: number | null;
  max_rate: number | null;
  stddev_rate: number | null;
  most_recent_rate: number | null;
  most_recent_rate_at: string | null;
};

const SORT_COLUMNS: Record<RateExplorerSort, string> = {
  sample_count: "sample_count",
  avg_rate: "avg_rate",
  description: "normalised_description",
};

/**
 * Lists canonical construction items — deliberately no project filter, since
 * the whole point of this layer is that one row spans every project it was
 * seen on. Only items with at least one priced sample are meaningful here,
 * so rows are implicitly scoped to sample_count > 0.
 */
export async function listRateLibraryItems(filters: RateExplorerFilters, sort: RateExplorerSort, page: number) {
  const supabase = await createClient();
  const safePage = Math.max(1, page);

  let query = supabase
    .from("rate_library_items")
    .select(
      "id, normalised_description, normalised_unit, category_division, construction_category, sample_count, project_count, avg_rate, median_rate, min_rate, max_rate, stddev_rate, most_recent_rate, most_recent_rate_at",
      { count: "estimated" },
    )
    .gt("sample_count", 0)
    .is("merged_into_id", null)
    .order(SORT_COLUMNS[sort], { ascending: sort === "description", nullsFirst: false })
    .order("id");

  if (filters.division) query = query.eq("category_division", filters.division);
  if (filters.category) query = query.eq("construction_category", filters.category);
  if (filters.unit) query = query.eq("normalised_unit", filters.unit);
  if (filters.minSampleCount) query = query.gte("sample_count", filters.minSampleCount);
  if (filters.description?.trim()) {
    query = query.textSearch("normalised_description_search", filters.description.trim(), {
      type: "websearch",
      config: "english",
    });
  }

  const from = (safePage - 1) * RATE_EXPLORER_PAGE_SIZE;
  const to = from + RATE_EXPLORER_PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listRateLibraryItems failed:", error.message);
    return { items: [] as RateLibraryItem[], count: 0, page: safePage, pageSize: RATE_EXPLORER_PAGE_SIZE };
  }

  return { items: data ?? [], count: count ?? 0, page: safePage, pageSize: RATE_EXPLORER_PAGE_SIZE };
}

export async function getRateExplorerFilterOptions() {
  const supabase = await createClient();

  const [{ data: divisions }, { data: categories }, { data: units }] = await Promise.all([
    supabase.rpc("list_rate_library_divisions"),
    supabase.rpc("list_rate_library_categories"),
    supabase.rpc("list_rate_library_units"),
  ]);

  return {
    divisions: divisions ?? [],
    categories: categories ?? [],
    units: units ?? [],
  };
}
