"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadHistoricalBoqBatchItem, type BatchUploadItemResult } from "@/lib/actions/historical-boq";
import { Alert } from "@/components/ui/alert";
import { historicalLibraryConfig } from "@/config/historical-boq";
import { isLegacyXlsFile } from "@/lib/historical-boq/parsers/is-legacy-xls";

const inputClass = "h-10 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type FileState = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  historicalBoqId?: string;
};

const acceptAttr = [...historicalLibraryConfig.acceptedMimeTypes, ...historicalLibraryConfig.acceptedExtensions].join(
  ",",
);

export function HistoricalBoqUploadForm({
  projects,
  returnToProject,
}: {
  projects: { id: string; name: string }[];
  returnToProject?: string;
}) {
  const [projectId, setProjectId] = useState("");
  const [files, setFiles] = useState<FileState[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFilesChosen(selected: FileList | null) {
    setPickError(null);
    if (!selected || selected.length === 0) {
      setFiles([]);
      return;
    }
    const legacyXls = Array.from(selected).find((f) => isLegacyXlsFile(f.name, f.type));
    if (legacyXls) {
      setPickError(
        `"${legacyXls.name}" is a legacy .xls file, which isn't supported. Please save it as .xlsx and choose it again.`,
      );
    }
    setFiles(Array.from(selected).map((file) => ({ file, status: "pending" })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    // Sequential, not Promise.all — bounds memory/bandwidth and keeps each
    // file's processing/error state independent, so one bad file can never
    // hide or abort another file's successful upload.
    for (let i = 0; i < files.length; i++) {
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));
      let result: BatchUploadItemResult;
      try {
        result = await uploadHistoricalBoqBatchItem(files[i].file, projectId || undefined);
      } catch {
        result = { fileName: files[i].file.name, status: "error", message: "Upload failed. Please try again." };
      }
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i
            ? result.status === "success"
              ? { ...f, status: "done", historicalBoqId: result.historicalBoqId }
              : { ...f, status: "error", message: result.message }
            : f,
        ),
      );
    }
    setIsSubmitting(false);
  }

  const successResults = files.filter((f) => f.status === "done" && f.historicalBoqId);
  const allSettled = files.length > 0 && files.every((f) => f.status === "done" || f.status === "error");
  const returnParam = returnToProject ? `?returnToProject=${returnToProject}` : "";

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {pickError && <Alert>{pickError}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Project (optional)
        <select
          name="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inputClass}
        >
          <option value="">No project — add to the organisation library</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Historical BOQs (Excel)
        <input
          type="file"
          name="file"
          accept={acceptAttr}
          multiple
          onChange={(e) => handleFilesChosen(e.target.files)}
          className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-white dark:file:text-zinc-900"
        />
        <span className="text-xs text-zinc-500">
          Excel (.xlsx) files, up to {historicalLibraryConfig.maxUploadSizeMb}MB each. You can select several at once.
          PDF and Word support is coming soon. Legacy .xls files aren&apos;t supported — please save as .xlsx first.
        </span>
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {files.map((f, idx) => (
            <li
              key={`${f.file.name}-${idx}`}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="truncate">{f.file.name}</span>
              <span
                className={
                  f.status === "error"
                    ? "text-red-600 dark:text-red-400"
                    : f.status === "done"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500"
                }
              >
                {f.status === "pending" && "Waiting"}
                {f.status === "uploading" && "Uploading..."}
                {f.status === "done" && "Done"}
                {f.status === "error" && (f.message ?? "Failed")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={files.length === 0 || isSubmitting}
        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "Uploading..." : "Upload & extract"}
      </button>

      {allSettled && (
        <div className="mt-2 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          {successResults.length > 0 ? (
            <p>
              {successResults.length} of {files.length} file(s) uploaded successfully.{" "}
              {successResults.length === 1 ? (
                <Link
                  href={`/dashboard/historical-library/uploads/${successResults[0].historicalBoqId}${returnParam}`}
                  className="font-medium hover:underline"
                >
                  View result
                </Link>
              ) : (
                <Link href="/dashboard/historical-library" className="font-medium hover:underline">
                  View Historical Library
                </Link>
              )}
            </p>
          ) : (
            <p>None of the selected files uploaded successfully. Fix the issues above and try again.</p>
          )}
        </div>
      )}
    </form>
  );
}
