"use client";

import { useActionState } from "react";
import { mergeCanonicalItems } from "@/lib/actions/canonical-items";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function CanonicalItemMergeButton({ sourceId, targetId }: { sourceId: string; targetId: string }) {
  const [state, formAction] = useActionState(mergeCanonicalItems, initialActionState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="targetId" value={targetId} />
      {state.status === "error" && state.message && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.message}</span>
      )}
      <SubmitButton pendingText="Merging..." className="h-8 px-3 text-xs">
        Merge into this item
      </SubmitButton>
    </form>
  );
}
