import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/format";
import type { ProjectStatus } from "@/types/database.types";

export const metadata: Metadata = { title: "Projects" };

const statusClasses: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  active: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  won: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  lost: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  archived: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      "id, name, client_name, tender_number, contract_number, town, province, sector, status, estimated_contract_value, created_at",
    )
    .order("created_at", { ascending: false });

  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `name.ilike.${term},client_name.ilike.${term},tender_number.ilike.${term},contract_number.ilike.${term},town.ilike.${term},province.ilike.${term}`,
    );
  }

  if (status) {
    query = query.eq("status", status as ProjectStatus);
  }

  const { data: projects } = await query;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New project
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" action="/dashboard/projects" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, client, tender, contract, town, province..."
          className="h-10 min-w-[280px] flex-1 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All statuses</option>
          {Object.keys(statusClasses).map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
        >
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Tender / contract</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Open project</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!projects || projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No projects yet.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="group relative border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-medium text-zinc-900 underline decoration-zinc-300 decoration-1 underline-offset-2 hover:decoration-zinc-900 dark:text-white dark:decoration-zinc-700 dark:hover:decoration-white"
                    >
                      {/* Stretches the link to cover the entire row, so clicking anywhere in the row opens the project. */}
                      <span className="absolute inset-0" aria-hidden="true" />
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{project.client_name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {project.tender_number ?? project.contract_number ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {[project.town, project.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {project.estimated_contract_value ? formatZAR(Number(project.estimated_contract_value)) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[project.status]}`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
