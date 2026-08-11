import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRateExplorerFilterOptions, listRateLibraryItems } from "@/lib/queries/rate-library-items";
import type { RateExplorerSort } from "@/lib/queries/rate-library-items";
import { formatZAR } from "@/lib/format";

export const metadata: Metadata = { title: "Rate Explorer" };

const inputClass = "h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const sortOptions: { value: RateExplorerSort; label: string }[] = [
  { value: "sample_count", label: "Most attested" },
  { value: "avg_rate", label: "Highest average rate" },
  { value: "description", label: "Description (A-Z)" },
];

type SearchParams = {
  division?: string;
  category?: string;
  unit?: string;
  description?: string;
  sort?: string;
  page?: string;
};

function buildPageHref(searchParams: SearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== "page" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/dashboard/rate-explorer?${params.toString()}`;
}

function formatRate(value: number | null): string {
  return value === null ? "—" : formatZAR(Number(value));
}

export default async function RateExplorerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort: RateExplorerSort =
    params.sort === "avg_rate" || params.sort === "description" ? params.sort : "sample_count";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [filterOptions, result] = await Promise.all([
    getRateExplorerFilterOptions(),
    listRateLibraryItems(
      {
        division: params.division,
        category: params.category,
        unit: params.unit,
        description: params.description,
      },
      sort,
      page,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.count / result.pageSize));

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rate Explorer</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {result.count.toLocaleString()} canonical construction item{result.count === 1 ? "" : "s"} — deduplicated
          and normalised across every project, with deterministic categorisation and rate statistics. No AI involved
          yet; this is the clean dataset the future embedding search will read from.
        </p>
      </div>

      <form className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" action="/dashboard/rate-explorer" method="GET">
        <input
          type="search"
          name="description"
          defaultValue={params.description}
          placeholder="Search description..."
          className={`${inputClass} col-span-2 lg:col-span-1`}
        />
        <select name="division" defaultValue={params.division ?? ""} className={inputClass}>
          <option value="">All divisions</option>
          {filterOptions.divisions.map((division) => (
            <option key={division} value={division}>
              {division}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={params.category ?? ""} className={inputClass}>
          <option value="">All categories</option>
          {filterOptions.categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select name="unit" defaultValue={params.unit ?? ""} className={inputClass}>
          <option value="">All units</option>
          {filterOptions.units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className={inputClass}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
        >
          Filter
        </button>
        <Link
          href="/dashboard/rate-explorer"
          className="flex h-10 items-center justify-center rounded-full px-5 text-sm text-zinc-500 hover:underline"
        >
          Clear
        </Link>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Division</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Samples</th>
              <th className="px-4 py-2 font-medium text-right">Projects</th>
              <th className="px-4 py-2 font-medium text-right">Avg</th>
              <th className="px-4 py-2 font-medium text-right">Median</th>
              <th className="px-4 py-2 font-medium text-right">Min</th>
              <th className="px-4 py-2 font-medium text-right">Max</th>
              <th className="px-4 py-2 font-medium text-right">Std dev</th>
              <th className="px-4 py-2 font-medium text-right">Most recent</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-6 text-center text-zinc-500">
                  No canonical items match these filters.
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-2">{item.normalised_description}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.normalised_unit ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.category_division ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.construction_category ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{item.sample_count}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{item.project_count}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatRate(item.avg_rate)}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{formatRate(item.median_rate)}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{formatRate(item.min_rate)}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{formatRate(item.max_rate)}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{formatRate(item.stddev_rate)}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {formatRate(item.most_recent_rate)}
                    {item.most_recent_rate_at && (
                      <div className="text-xs text-zinc-400">
                        {new Date(item.most_recent_rate_at).toLocaleDateString("en-ZA")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/dashboard/historical-library?canonicalItemId=${item.id}`}
                      className="text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      View {item.sample_count} source item{item.sample_count === 1 ? "" : "s"} →
                    </Link>
                    {isAdmin && (
                      <Link
                        href={`/dashboard/admin/canonical-items/${item.id}`}
                        className="ml-3 text-zinc-600 hover:underline dark:text-zinc-400"
                      >
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Page {result.page} of {totalPages.toLocaleString()}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={buildPageHref(params, result.page - 1)}
                className="rounded-full border border-zinc-300 px-4 py-1.5 dark:border-zinc-700"
              >
                Previous
              </Link>
            )}
            {result.page < totalPages && (
              <Link
                href={buildPageHref(params, result.page + 1)}
                className="rounded-full border border-zinc-300 px-4 py-1.5 dark:border-zinc-700"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
