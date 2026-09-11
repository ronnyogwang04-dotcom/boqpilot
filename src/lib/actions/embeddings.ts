"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/audit/log-event";
import { createSupabaseEmbeddingRepository, getEmbeddingWorkload, runEmbeddingBackfill } from "@/lib/embeddings/backfill";
import { isEmbeddingConfigured } from "@/lib/embeddings/openai-client";
import type { ActionState } from "@/types/action-state";

/**
 * Read-only — never calls OpenAI, safe to call with no API key configured.
 * Used to render the dry-run workload report on the admin embeddings page.
 */
export async function getEmbeddingDryRun() {
  const admin = await requireAdmin();
  if (!admin) return null;

  const repo = createSupabaseEmbeddingRepository(admin.supabase);
  return getEmbeddingWorkload(repo, admin.organisationId);
}

/**
 * Processes a small, explicitly bounded batch — never the whole library in
 * one call. Returns a friendly ActionState error (not a thrown exception)
 * when OPENAI_API_KEY isn't configured, since this button is reachable from
 * the UI before the key is ever set up.
 */
export async function runEmbeddingSampleBatch(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You must be an admin to do that." };
  }

  if (!isEmbeddingConfigured()) {
    return {
      status: "error",
      message: "OPENAI_API_KEY isn't configured yet — add it to the environment before running a live batch.",
    };
  }

  const limitRaw = Number(formData.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 10;

  const repo = createSupabaseEmbeddingRepository(admin.supabase);

  try {
    const summary = await runEmbeddingBackfill(repo, admin.organisationId, { limit });

    await logAuditEvent(admin.supabase, {
      organisationId: admin.organisationId,
      actorUserId: admin.userId,
      eventType: "settings_change",
      entityType: "rate_library_items_embedding_backfill",
      metadata: {
        attempted: summary.attempted,
        succeeded: summary.succeeded,
        failed: summary.failed,
        api_calls: summary.apiCalls,
      },
    });

    revalidatePath("/dashboard/admin/embeddings");
    revalidatePath("/dashboard/admin/canonical-items");

    return {
      status: "success",
      message: `Processed ${summary.attempted} item${summary.attempted === 1 ? "" : "s"}: ${summary.succeeded} embedded, ${summary.failed} failed.`,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Embedding batch failed." };
  }
}
