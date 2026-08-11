import { createClient } from "@/lib/supabase/server";
import type { HistoricalBoqItemStatus, HistoricalBoqRowType } from "@/types/database.types";

export const HISTORICAL_LIBRARY_PAGE_SIZE = 50;

// A bare "YYYY-MM-DD" from a <input type="date"> is midnight for that day —
// used as-is in a `.lte()` against a timestamptz column it would exclude
// every row uploaded later that same day. Comparing against the start of the
// following day instead makes the "To" filter inclusive of its whole day.
function dayAfter(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export type HistoricalLibraryFilters = {
  projectId?: string;
  section?: string;
  description?: string;
  unit?: string;
  category?: string;
  status?: HistoricalBoqItemStatus;
  rowType?: HistoricalBoqRowType;
  uploadedFrom?: string;
  uploadedTo?: string;
  historicalBoqId?: string;
  canonicalItemId?: string;
};

export type HistoricalLibraryItem = {
  id: string;
  project_id: string;
  historical_boq_id: string;
  uploaded_at: string;
  row_number: number;
  row_type: HistoricalBoqRowType;
  section: string | null;
  item_code: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  unit_rate: number | null;
  amount: number | null;
  category: string | null;
  status: HistoricalBoqItemStatus;
};

export async function listHistoricalBoqItems(filters: HistoricalLibraryFilters, page: number) {
  const supabase = await createClient();
  const safePage = Math.max(1, page);

  let query = supabase
    .from("historical_boq_items")
    .select(
      "id, project_id, historical_boq_id, uploaded_at, row_number, row_type, section, item_code, description, unit, quantity, unit_rate, amount, category, status",
      { count: "estimated" },
    )
    .order("uploaded_at", { ascending: false })
    .order("row_number", { ascending: true });

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.historicalBoqId) query = query.eq("historical_boq_id", filters.historicalBoqId);
  if (filters.canonicalItemId) query = query.eq("canonical_item_id", filters.canonicalItemId);
  if (filters.section) query = query.eq("section", filters.section);
  if (filters.unit) query = query.eq("unit", filters.unit);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rowType) query = query.eq("row_type", filters.rowType);
  if (filters.uploadedFrom) query = query.gte("uploaded_at", filters.uploadedFrom);
  if (filters.uploadedTo) query = query.lt("uploaded_at", dayAfter(filters.uploadedTo));
  if (filters.description?.trim()) {
    query = query.textSearch("description_search", filters.description.trim(), {
      type: "websearch",
      config: "english",
    });
  }

  const from = (safePage - 1) * HISTORICAL_LIBRARY_PAGE_SIZE;
  const to = from + HISTORICAL_LIBRARY_PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listHistoricalBoqItems failed:", error.message);
    return { items: [] as HistoricalLibraryItem[], count: 0, page: safePage, pageSize: HISTORICAL_LIBRARY_PAGE_SIZE };
  }

  return { items: data ?? [], count: count ?? 0, page: safePage, pageSize: HISTORICAL_LIBRARY_PAGE_SIZE };
}

export async function getHistoricalLibraryFilterOptions() {
  const supabase = await createClient();

  const [{ data: projects }, { data: sections }, { data: units }, { data: categories }] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.rpc("list_historical_boq_sections"),
    supabase.rpc("list_historical_boq_units"),
    supabase.rpc("list_historical_boq_categories"),
  ]);

  return {
    projects: projects ?? [],
    sections: sections ?? [],
    units: units ?? [],
    categories: categories ?? [],
  };
}
