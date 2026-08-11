import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { BoqUploadForm } from "@/components/boq/upload-form";
import { TrustNotice } from "@/components/shared/trust-notice";

export const metadata: Metadata = { title: "Upload BOQ" };

export default async function BoqUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).single();

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Upload a BOQ</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Uploading to <span className="font-medium">{project.name}</span>. We&apos;ll count its pages and
        work out pricing before anything is processed.
      </p>
      <div className="mt-6">
        <TrustNotice />
      </div>
      <BoqUploadForm projectId={project.id} />
    </div>
  );
}
