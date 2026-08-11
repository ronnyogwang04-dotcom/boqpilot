import Link from "next/link";
import type { Metadata } from "next";
import { getHistoricalLibraryFilterOptions, listHistoricalBoqItems } from "@/lib/queries/historical-boq-items";
import type { HistoricalBoqItemStatus, HistoricalBoqRowType } from "@/types/database.types";

export const metadata: Metadata = { title: "Historical Rate Library" };

const inputClass = "h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const statusOptions: { value: HistoricalBoqItemStatus; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "needs_review", label: "Needs review" },
  { value: "error", label: "Error" },
];

const statusClasses: Record<HistoricalBoqItemStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  needs_review: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  error: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

// Fixed, small enum — no filter-option RPC needed (unlike section/unit/
// category, which are open-ended free text from the source file).
const rowTypeOptions: { value: HistoricalBoqRowType; label: string }[] = [
  { value: "rate_item", label: "Rate item" },
  { value: "bill_heading", label: "Bill heading" },
  { value: "section_heading", label: "Section heading" },
  { value: "subtotal_total", label: "Subtotal / total" },
  { value: "preliminary_general", label: "Preliminaries / general" },
  { value: "note_specification", label: "Note / specification" },
  { value: "contractual_text", label: "Contractual text" },
  { value: "general_text", label: "Other non-rate text" },
];

const rowTypeLabels = new Map(rowTypeOptions.map((option) => [option.value, option.label]));

type SearchParams = {
  project?: string;
  section?: string;
  description?: string;
  unit?: string;
  category?: string;
  status?: string;
  rowType?: string;
  from?: string;
  to?: string;
  historicalBoqId?: string;
  canonicalItemId?: string;
  page?: string;
};

function buildPageHref(searchParams: SearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== "page" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/dashboard/historical-library?${params.toString()}`;
}

export default async function HistoricalLibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [filterOptions, result] = await Promise.all([
    getHistoricalLibraryFilterOptions(),
    listHistoricalBoqItems(
      {
        projectId: params.project,
        section: params.section,
        description: params.description,
        unit: params.unit,
        category: params.category,
        status: params.status as HistoricalBoqItemStatus | undefined,
        rowType: params.rowType as HistoricalBoqRowType | undefined,
        uploadedFrom: params.from,
        uploadedTo: params.to,
        historicalBoqId: params.historicalBoqId,
        canonicalItemId: params.canonicalItemId,
      },
      page,
    ),
  ]);

  const projectsById = new Map(filterOptions.projects.map((project) => [project.id, project.name]));
  const totalPages = Math.max(1, Math.ceil(result.count / result.pageSize));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historical Rate Library</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {result.count.toLocaleString()} extracted line item{result.count === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href="/dashboard/historical-library/upload"
          className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Upload historical BOQ
        </Link>
      </div>

      <form className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" action="/dashboard/historical-library" method="GET">
        <input
          type="search"
          name="description"
          defaultValue={params.description}
          placeholder="Search description..."
          className={`${inputClass} col-span-2 lg:col-span-1`}
        />
        <select name="project" defaultValue={params.project ?? ""} className={inputClass}>
          <option value="">All projects</option>
          {filterOptions.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select name="section" defaultValue={params.section ?? ""} className={inputClass}>
          <option value="">All sections</option>
          {filterOptions.sections.map((section) => (
            <option key={section} value={section}>
              {section}
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
        <select name="category" defaultValue={params.category ?? ""} className={inputClass}>
          <option value="">All categories</option>
          {filterOptions.categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select name="rowType" defaultValue={params.rowType ?? ""} className={inputClass}>
          <option value="">All row types</option>
          {rowTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          From
          <input type="date" name="from" defaultValue={params.from} className={`${inputClass} w-full`} />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          To
          <input type="date" name="to" defaultValue={params.to} className={`${inputClass} w-full`} />
        </label>
        <button
          type="submit"
          className="h-10 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
        >
          Filter
        </button>
        <Link
          href="/dashboard/historical-library"
          className="flex h-10 items-center justify-center rounded-full px-5 text-sm text-zinc-500 hover:underline"
        >
          Clear
        </Link>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Section</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Rate</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-zinc-500">
                  No line items match these filters.
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {projectsById.get(item.project_id) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {item.row_type === "rate_item" ? (
                      "Rate item"
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        {rowTypeLabels.get(item.row_type) ?? item.row_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.section ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.item_code ?? "—"}</td>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.unit ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.quantity ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.unit_rate ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.amount ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{item.category ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[item.status]}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {new Date(item.uploaded_at).toLocaleDateString("en-ZA")}
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
