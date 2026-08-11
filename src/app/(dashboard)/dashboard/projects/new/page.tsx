import type { Metadata } from "next";
import { createProject } from "@/lib/actions/projects";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every BOQ you upload belongs to a project — create one to get started.
      </p>
      <div className="mt-8">
        <ProjectForm action={createProject} submitLabel="Create project" />
      </div>
    </div>
  );
}
