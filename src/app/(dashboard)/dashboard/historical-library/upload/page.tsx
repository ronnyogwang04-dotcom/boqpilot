import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HistoricalBoqUploadForm } from "@/components/historical-boq/upload-form";

export const metadata: Metadata = { title: "Upload historical BOQ" };

export default async function UploadHistoricalBoqPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Upload historical BOQ</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every line item is extracted and added to the{" "}
        <Link href="/dashboard/historical-library" className="hover:underline">
          Historical Rate Library
        </Link>
        .
      </p>

      {!projects || projects.length === 0 ? (
        <p className="mt-8 rounded-md border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          You need a project before uploading a historical BOQ.{" "}
          <Link href="/dashboard/projects/new" className="font-medium hover:underline">
            Create one first
          </Link>
          .
        </p>
      ) : (
        <HistoricalBoqUploadForm projects={projects} />
      )}
    </div>
  );
}
