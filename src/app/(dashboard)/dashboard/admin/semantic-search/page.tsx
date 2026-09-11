import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isEmbeddingConfigured } from "@/lib/embeddings/openai-client";
import { SemanticSearchForm } from "@/components/admin/semantic-search-form";

export const metadata: Metadata = { title: "Semantic Rate Explorer" };

export default async function SemanticSearchAdminPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const configured = isEmbeddingConfigured();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Semantic Rate Explorer</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Phase 4 — test tool for embedding-based retrieval over the historical rate library. Ranking combines vector
        similarity with unit and construction-category context (see{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">rank-candidate.ts</code>). Read-only: this
        never merges, alters, or creates canonical items, and is not connected to the BOQ pricing workflow.
      </p>

      <div className="mt-6">
        <SemanticSearchForm isConfigured={configured} />
      </div>
    </div>
  );
}
