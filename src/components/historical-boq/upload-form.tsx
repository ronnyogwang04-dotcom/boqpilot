"use client";

import { useActionState } from "react";
import { uploadHistoricalBoq } from "@/lib/actions/historical-boq";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";
import { historicalLibraryConfig } from "@/config/historical-boq";

const inputClass = "h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function HistoricalBoqUploadForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(uploadHistoricalBoq, initialActionState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Project
        <select name="projectId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a project
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Historical BOQ (Excel)
        <input
          type="file"
          name="file"
          accept={[...historicalLibraryConfig.acceptedMimeTypes, ...historicalLibraryConfig.acceptedExtensions].join(
            ",",
          )}
          required
          className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-white dark:file:text-zinc-900"
        />
        <span className="text-xs text-zinc-500">
          .xlsx or .xls, up to {historicalLibraryConfig.maxUploadSizeMb}MB. PDF and Word support is coming soon.
        </span>
      </label>

      <SubmitButton pendingText="Extracting line items..." className="mt-2 w-full">
        Upload &amp; extract
      </SubmitButton>
    </form>
  );
}
