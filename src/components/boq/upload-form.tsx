"use client";

import { useActionState } from "react";
import { uploadBoq } from "@/lib/actions/boq";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function BoqUploadForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(uploadBoq, initialActionState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />

      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        BOQ document (PDF)
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          required
          className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-white dark:file:text-zinc-900"
        />
      </label>

      <SubmitButton pendingText="Reading BOQ..." className="mt-2 w-full">
        Upload BOQ
      </SubmitButton>
    </form>
  );
}
