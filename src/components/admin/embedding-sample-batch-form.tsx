"use client";

import { useActionState } from "react";
import { runEmbeddingSampleBatch } from "@/lib/actions/embeddings";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function EmbeddingSampleBatchForm({ isConfigured }: { isConfigured: boolean }) {
  const [state, formAction] = useActionState(runEmbeddingSampleBatch, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      {!isConfigured && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          OPENAI_API_KEY isn&apos;t set in the environment yet — add it before running a live batch.
        </p>
      )}

      <fieldset disabled={!isConfigured} className="flex flex-col gap-3 disabled:opacity-50">
        <label className="flex items-center gap-2 text-sm">
          Batch size
          <input
            type="number"
            name="limit"
            defaultValue={10}
            min={1}
            max={500}
            className="h-9 w-24 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <SubmitButton pendingText="Embedding..." className="self-start">
          Run sample batch
        </SubmitButton>
      </fieldset>
    </form>
  );
}
