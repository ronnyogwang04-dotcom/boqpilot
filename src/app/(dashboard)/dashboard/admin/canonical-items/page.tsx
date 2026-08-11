import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listCanonicalItems } from "@/lib/queries/canonical-items";
import { getRateExplorerFilterOptions } from "@/lib/queries/rate-library-items";
import { isKnownUnit } from "@/lib/construction-intelligence/normalise-unit";
import { formatZAR } from "@/lib/format";

export const metadata: Metadata = { title: "Canonical Items" };

const inputClass = "h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type SearchParams = {
  division?: string;
  category?: string;
  unit?: string;
  description?: string;
  singleton?: string;
  page?: string;
};

function buildPageHref(searchParams: SearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== "page" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/dashboard/admin/canonical-items?${params.toString()}`;
}

export default async function CanonicalItemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") notFound();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const singletonOnly = params.singleton === "1";

  const [filterOptions, result] = await Promise.all([
    getRateExplorerFilterOptions(),
    listCanonicalItems(
      {
        division: params.division,
        category: params.category,
        unit: params.unit,
        description: params.description,
        singletonOnly,
      },
      page,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.count / result.pageSize));

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Canonical Items</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {result.count.toLocaleString()} canonical construction item{result.count === 1 ? "" : "s"} — correct
          descriptions, units and categories the normalisation engine got wrong, or merge near-duplicates it
          couldn&apos;t catch on its own.
        </p>
      </div>

      <form
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        action="/dashboard/admin/canonical-items"
        method="GET"
      >
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
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="singleton" value="1" defaultChecked={singletonOnly} />
          Singletons only
        </label>
        <button
          type="submit"
          className="h-10 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
        >
          Filter
        </button>
        <Link
          href="/dashboard/admin/canonical-items"
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
              <th className="px-4 py-2 font-medium text-right">Avg rate</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No canonical items match these filters.
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-2">{item.normalised_description}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {item.normalised_unit ?? "—"}
                    {!isKnownUnit(item.normalised_unit) && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                        unrecognised unit
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.category_division ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.construction_category ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{item.sample_count}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {item.avg_rate === null ? "—" : formatZAR(Number(item.avg_rate))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/dashboard/admin/canonical-items/${item.id}`}
                      className="text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      Review →
                    </Link>
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
