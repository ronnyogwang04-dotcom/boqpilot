import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { CheckCircle2, CircleDashed, TriangleAlert, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { HistoricalBoqProcessingJobStatus } from "@/types/database.types";

export const metadata: Metadata = { title: "Historical BOQ upload" };

const statusCopy: Record<HistoricalBoqProcessingJobStatus, string> = {
  UPLOADED: "Uploaded — waiting to be parsed",
  PARSING: "Reading the spreadsheet",
  VALIDATING: "Validating extracted rows",
  COMPLETED: "Completed",
  COMPLETED_WITH_ERRORS: "Completed with some rows needing review",
  FAILED: "Failed",
};

export default async function HistoricalBoqUploadResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnToProject?: string }>;
}) {
  const { id } = await params;
  const { returnToProject: rawReturnToProject } = await searchParams;
  const supabase = await createClient();

  const { data: historicalBoq } = await supabase
    .from("historical_boqs")
    .select("id, original_filename, project_id, created_at")
    .eq("id", id)
    .single();

  if (!historicalBoq) {
    notFound();
  }

  const parsedReturnToProject = z.string().uuid().safeParse(rawReturnToProject);
  // Fall back to the historical BOQ's own source project (if any) so users
  // who land here without the query param — e.g. from a bookmark — still get
  // the "Price this BOQ" shortcut when it's derivable.
  const returnToProject = parsedReturnToProject.success ? parsedReturnToProject.data : (historicalBoq.project_id ?? undefined);

  const [{ data: job }, { data: project }] = await Promise.all([
    supabase
      .from("historical_boq_processing_jobs")
      .select(
        "status, rows_detected, rows_extracted, rows_needs_review, rows_error, failure_reason, error_summary",
      )
      .eq("historical_boq_id", id)
      .single(),
    historicalBoq.project_id
      ? supabase.from("projects").select("id, name").eq("id", historicalBoq.project_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!job) {
    notFound();
  }

  // "Price this BOQ" only makes sense if the return project has a current
  // BOQ that's already paid+extracted — a small existence check, not the
  // full project workflow stepper (that lives on the project page itself).
  let priceableBoq: { id: string; filename: string; projectId: string } | null = null;
  if (returnToProject) {
    const { data: latestVersion } = await supabase
      .from("project_versions")
      .select("id")
      .eq("project_id", returnToProject)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersion) {
      const { data: currentBoq } = await supabase
        .from("boqs")
        .select("id, filename")
        .eq("project_version_id", latestVersion.id)
        .maybeSingle();

      if (currentBoq) {
        const { data: currentJob } = await supabase
          .from("processing_jobs")
          .select("status")
          .eq("boq_id", currentBoq.id)
          .maybeSingle();

        if (currentJob?.status === "COMPLETED") {
          priceableBoq = { id: currentBoq.id, filename: currentBoq.filename, projectId: returnToProject };
        }
      }
    }
  }

  const sampleErrors = (job.error_summary as
    | { rowNumber: number; description: string; errors: string[] | null }[]
    | null) ?? [];

  const isTerminal = job.status === "COMPLETED" || job.status === "COMPLETED_WITH_ERRORS" || job.status === "FAILED";
  const returnParam = parsedReturnToProject.success ? `?returnToProject=${parsedReturnToProject.data}` : "";

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/dashboard/historical-library" className="hover:underline">
          Historical Rate Library
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{historicalBoq.original_filename}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {project ? (
          <Link href={`/dashboard/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        ) : (
          "Added to the organisation library"
        )}
        {" · "}
        {new Date(historicalBoq.created_at).toLocaleString("en-ZA")}
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {job.status === "FAILED" ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        ) : job.status === "COMPLETED_WITH_ERRORS" ? (
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : isTerminal ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CircleDashed className="h-5 w-5 shrink-0 animate-spin text-zinc-500" />
        )}
        <div>
          <p className="font-medium">{statusCopy[job.status]}</p>
          {job.status === "FAILED" && job.failure_reason && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{job.failure_reason}</p>
          )}
        </div>
      </div>

      {isTerminal && job.status !== "FAILED" && (
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Rows detected</dt>
            <dd className="mt-1 text-xl font-semibold">{job.rows_detected}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Extracted</dt>
            <dd className="mt-1 text-xl font-semibold">{job.rows_extracted}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Needs review</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400">
              {job.rows_needs_review}
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">Errors</dt>
            <dd className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">{job.rows_error}</dd>
          </div>
        </dl>
      )}

      {isTerminal && (
        <div className="mt-8 flex flex-wrap gap-3">
          {priceableBoq && (
            <Link
              href={`/dashboard/projects/${priceableBoq.projectId}/boq/${priceableBoq.id}/items`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Price {priceableBoq.filename}
            </Link>
          )}
          <Link
            href={`/dashboard/historical-library/upload${returnParam}`}
            className={
              priceableBoq
                ? "inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
                : "inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            }
          >
            Upload another historical BOQ
          </Link>
          {parsedReturnToProject.success && (
            <Link
              href={`/dashboard/projects/${parsedReturnToProject.data}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
            >
              Return to project
            </Link>
          )}
          {job.status !== "FAILED" && (
            <Link
              href={`/dashboard/historical-library?historicalBoqId=${historicalBoq.id}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
            >
              View extracted items
            </Link>
          )}
        </div>
      )}

      {sampleErrors.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Rows flagged for review</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {sampleErrors.map((entry) => (
              <li key={entry.rowNumber} className="rounded-md border border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <p className="font-medium">
                  Row {entry.rowNumber} — {entry.description}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.errors?.join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
