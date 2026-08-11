import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatZAR, formatFileSize } from "@/lib/format";
import { getPricingTierLabel, pricingConfig } from "@/config/pricing";
import { processingStageLabels } from "@/lib/processing/status";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = { title: "BOQ Processing Preview" };

function formatEstimate(pageCount: number): string {
  const seconds = pageCount * pricingConfig.estimatedSecondsPerPage;
  if (seconds < 60) return `~${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export default async function BoqPreviewPage({
  params,
}: {
  params: Promise<{ id: string; boqId: string }>;
}) {
  const { id, boqId } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: boq }, { data: job }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).single(),
    supabase
      .from("boqs")
      .select("id, filename, file_size_bytes, page_count, pricing_tier, price, currency, is_free")
      .eq("id", boqId)
      .eq("project_id", id)
      .single(),
    supabase.from("processing_jobs").select("status").eq("boq_id", boqId).single(),
  ]);

  if (!project || !boq || !job) {
    notFound();
  }

  const isEnterprise = boq.pricing_tier === "enterprise";
  const isUnlocked = job.status !== "WAITING_FOR_PAYMENT";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">BOQ Processing Preview</h1>

      <div className="mt-6 rounded-lg border border-zinc-200 p-6 text-sm dark:border-zinc-800">
        <dl className="flex flex-col gap-3">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Project</dt>
            <dd className="font-medium">
              <Link href={`/dashboard/projects/${project.id}`} className="hover:underline">
                {project.name}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">File name</dt>
            <dd className="font-medium">{boq.filename}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">File size</dt>
            <dd className="font-medium">{boq.file_size_bytes ? formatFileSize(boq.file_size_bytes) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Number of pages</dt>
            <dd className="font-medium">{boq.page_count}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Pricing tier</dt>
            <dd className="font-medium">{getPricingTierLabel(boq.pricing_tier)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Price</dt>
            <dd className="font-medium">
              {boq.is_free ? "FREE" : isEnterprise ? "Custom" : formatZAR(Number(boq.price))}
            </dd>
          </div>
          {!isEnterprise && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Estimated processing time</dt>
              <dd className="font-medium">{formatEstimate(boq.page_count)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{processingStageLabels[job.status]}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        {isEnterprise ? (
          <p className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {pricingConfig.enterpriseMessage}
          </p>
        ) : isUnlocked ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
            Ready for processing.{" "}
            <Link href={`/dashboard/projects/${project.id}/boq/${boq.id}/processing`} className="underline">
              View processing status
            </Link>
            .
          </div>
        ) : (
          <form action={`/api/boq/${boq.id}/pay`} method="POST">
            <SubmitButton pendingText="Redirecting..." className="w-full">
              Proceed to Payment
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
