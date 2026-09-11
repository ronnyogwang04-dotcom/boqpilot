import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listBoqRateItems } from "@/lib/queries/boq-line-items";
import { getMarkupSettings } from "@/lib/actions/pricing-settings";
import { EstimatorPricingGrid } from "@/components/boq/estimator-pricing-grid";

export const metadata: Metadata = { title: "BOQ Pricing" };

export default async function BoqItemsPage({ params }: { params: Promise<{ id: string; boqId: string }> }) {
  const { id, boqId } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: boq }, { data: job }, items, markupDefaults] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).single(),
    supabase.from("boqs").select("id, filename").eq("id", boqId).eq("project_id", id).single(),
    supabase.from("processing_jobs").select("status").eq("boq_id", boqId).single(),
    listBoqRateItems(boqId),
    getMarkupSettings(),
  ]);

  if (!project || !boq || !job) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-zinc-500">
        <Link href={`/dashboard/projects/${project.id}`} className="hover:underline">
          {project.name}
        </Link>{" "}
        / {boq.filename}
      </p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">BOQ Pricing</h1>
        {job.status === "COMPLETED" && items.length > 0 && (
          <a
            href={`/api/projects/${id}/boq/${boqId}/export`}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Download Excel
          </a>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Historical benchmarks and cost build-ups are suggestions only — nothing here is applied automatically. Expand a
        row to see the evidence behind a suggestion and enter your own rate.
      </p>

      {job.status !== "COMPLETED" ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          This BOQ hasn&apos;t finished processing yet ({job.status}).{" "}
          <Link href={`/dashboard/projects/${id}/boq/${boqId}/processing`} className="underline">
            View processing status
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
          No rate-bearing line items were found in this BOQ.
        </p>
      ) : (
        <div className="mt-6">
          <EstimatorPricingGrid items={items} markupDefaults={markupDefaults} />
        </div>
      )}
    </div>
  );
}
