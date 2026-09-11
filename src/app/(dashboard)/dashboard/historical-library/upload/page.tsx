import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HistoricalBoqUploadForm } from "@/components/historical-boq/upload-form";

export const metadata: Metadata = { title: "Upload historical BOQ" };

export default async function UploadHistoricalBoqPage({
  searchParams,
}: {
  searchParams: Promise<{ returnToProject?: string }>;
}) {
  const { returnToProject: rawReturnToProject } = await searchParams;
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");

  const parsedReturnToProject = z.string().uuid().safeParse(rawReturnToProject);
  const returnToProject = parsedReturnToProject.success ? parsedReturnToProject.data : undefined;

  // A returnToProject that doesn't resolve (wrong org, deleted, malformed)
  // just means the banner/CTA below is silently dropped — RLS already keeps
  // this read scoped to the caller's organisation, so nothing needs a
  // separate ownership check.
  const returnProject = returnToProject
    ? (await supabase.from("projects").select("id, name").eq("id", returnToProject).single()).data
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Upload historical BOQ</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every line item is extracted and added to your organisation&apos;s{" "}
        <Link href="/dashboard/historical-library" className="hover:underline">
          Historical Rate Library
        </Link>
        , where it stays available to benchmark every future project.
      </p>

      {returnProject && (
        <p className="mt-4 rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Returning to{" "}
          <Link href={`/dashboard/projects/${returnProject.id}`} className="font-medium hover:underline">
            {returnProject.name}
          </Link>{" "}
          once this upload finishes.
        </p>
      )}

      <HistoricalBoqUploadForm projects={projects ?? []} returnToProject={returnProject?.id} />
    </div>
  );
}
