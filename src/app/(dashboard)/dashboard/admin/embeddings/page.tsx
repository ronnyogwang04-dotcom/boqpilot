import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseEmbeddingRepository, getEmbeddingWorkload, previewEmbeddingInputs } from "@/lib/embeddings/backfill";
import { isEmbeddingConfigured } from "@/lib/embeddings/openai-client";
import { embeddingConfig } from "@/config/embeddings";
import { EmbeddingStatusBadge } from "@/components/admin/embedding-status-badge";
import { EmbeddingSampleBatchForm } from "@/components/admin/embedding-sample-batch-form";

export const metadata: Metadata = { title: "Embeddings" };

const PREVIEW_LIMIT = 8;

export default async function EmbeddingsAdminPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const repo = createSupabaseEmbeddingRepository(admin.supabase);
  const [workload, previews] = await Promise.all([
    getEmbeddingWorkload(repo, admin.organisationId),
    previewEmbeddingInputs(repo, admin.organisationId, PREVIEW_LIMIT),
  ]);

  const configured = isEmbeddingConfigured();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Embeddings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Phase 3 — semantic similarity/retrieval over canonical construction items. Model{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">{embeddingConfig.model}</code>. This never
        rewrites <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">normalised_description</code> or
        changes canonicalisation — embeddings are read-only for retrieval, never used to auto-merge items.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total canonical items", value: workload.totalCanonicalItems },
          { label: "Eligible (priced, not merged)", value: workload.eligible },
          { label: "Already embedded", value: workload.byStatus.current },
          { label: "Needs embedding", value: workload.needsEmbeddingCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["pending", "stale", "failed", "current"] as const).map((status) => (
          <div key={status} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <EmbeddingStatusBadge status={status} />
            <span className="text-sm font-medium">{workload.byStatus[status].toLocaleString()}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Estimated workload for what&apos;s outstanding: ~{workload.estimatedBatches.toLocaleString()} API call
        {workload.estimatedBatches === 1 ? "" : "s"} (batch size {embeddingConfig.batchSize}), ~
        {workload.estimatedTokens.toLocaleString()} tokens (rough character-count estimate, not a billed quote).
      </p>

      <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Sample of what would be sent to OpenAI</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Exact <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">embedding_input_text</code> for the
          next {PREVIEW_LIMIT} items needing an embedding — no API call made to produce this list.
        </p>
        {previews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing outstanding — every eligible item is already embedded.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {previews.map((preview) => (
              <li key={preview.id} className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{preview.description ?? "(no description)"}</span>
                  <EmbeddingStatusBadge status={preview.status} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{preview.inputText}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Run a sample batch</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Processes a small, explicitly bounded number of outstanding items. Re-running is always safe: already-current
          items are skipped (idempotent), and results are saved per item as they complete.
        </p>
        <div className="mt-4">
          <EmbeddingSampleBatchForm isConfigured={configured} />
        </div>
      </div>
    </div>
  );
}
