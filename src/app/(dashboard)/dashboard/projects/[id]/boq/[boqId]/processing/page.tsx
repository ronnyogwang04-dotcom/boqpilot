import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  processingProgressPercent,
  processingStageLabels,
  processingStageOrder,
} from "@/lib/processing/status";

export const metadata: Metadata = { title: "Processing" };

export default async function BoqProcessingPage({
  params,
}: {
  params: Promise<{ id: string; boqId: string }>;
}) {
  const { id, boqId } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("processing_jobs")
    .select("job_number, status, progress, estimated_completion, failure_reason")
    .eq("boq_id", boqId)
    .eq("project_id", id)
    .single();

  if (!job) {
    notFound();
  }

  const currentIndex = processingStageOrder.indexOf(job.status);
  const percent = processingProgressPercent(job.status);
  const isTerminalFailure = job.status === "FAILED" || job.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Processing job #{job.job_number}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={`/dashboard/projects/${id}/boq/${boqId}`} className="hover:underline">
          Back to BOQ
        </Link>
      </p>

      {isTerminalFailure ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{processingStageLabels[job.status]}</p>
            {job.failure_reason && <p className="mt-1">{job.failure_reason}</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all dark:bg-white"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {percent}% — {processingStageLabels[job.status]}
            </p>
          </div>

          {job.status === "QUEUED" && (
            <p className="mt-4 rounded-md border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              Your BOQ is queued for processing.
            </p>
          )}

          {job.status === "COMPLETED" && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
              Extraction complete.{" "}
              <Link href={`/dashboard/projects/${id}/boq/${boqId}/items`} className="underline">
                View pricing
              </Link>
              .
            </div>
          )}

          <ol className="mt-6 flex flex-col gap-3 text-sm">
            {processingStageOrder.map((stage, index) => {
              const done = currentIndex > index || job.status === "COMPLETED";
              const active = index === currentIndex && job.status !== "COMPLETED";
              return (
                <li key={stage} className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleDashed
                      className={`h-5 w-5 shrink-0 ${active ? "text-zinc-900 dark:text-white" : "text-zinc-300 dark:text-zinc-700"}`}
                    />
                  )}
                  <span className={active ? "font-medium" : done ? "" : "text-zinc-400 dark:text-zinc-600"}>
                    {processingStageLabels[stage]}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
