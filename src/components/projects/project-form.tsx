"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";
import type { ActionState } from "@/types/action-state";
import type { Database, ProjectSector } from "@/types/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const inputClass =
  "h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900";
const textareaClass =
  "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

const sectors: { value: ProjectSector; label: string }[] = [
  { value: "building", label: "Building" },
  { value: "civil", label: "Civil" },
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical" },
];

const statuses = ["draft", "active", "submitted", "won", "lost", "archived"] as const;

export function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Project name
          <input
            type="text"
            name="name"
            required
            defaultValue={project?.name}
            className={inputClass}
          />
          {state.fieldErrors?.name && (
            <span className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.name[0]}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Description
          <textarea name="description" rows={3} defaultValue={project?.description ?? ""} className={textareaClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            Project number
            <input type="text" name="projectNumber" defaultValue={project?.project_number ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Tender number
            <input type="text" name="tenderNumber" defaultValue={project?.tender_number ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Contract number
            <input type="text" name="contractNumber" defaultValue={project?.contract_number ?? ""} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            Client
            <input type="text" name="clientName" defaultValue={project?.client_name ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Contractor
            <input type="text" name="contractorName" defaultValue={project?.contractor_name ?? ""} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            Province
            <input type="text" name="province" defaultValue={project?.province ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Municipality
            <input type="text" name="municipality" defaultValue={project?.municipality ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Town
            <input type="text" name="town" defaultValue={project?.town ?? ""} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          Physical address
          <input type="text" name="physicalAddress" defaultValue={project?.physical_address ?? ""} className={inputClass} />
        </label>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Sector &amp; value</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {sectors.map((sector) => (
            <label key={sector.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sector"
                value={sector.value}
                defaultChecked={project?.sector?.includes(sector.value)}
              />
              {sector.label}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm sm:w-64">
          Estimated contract value (ZAR)
          <input
            type="number"
            name="estimatedContractValue"
            min="0"
            step="0.01"
            defaultValue={project?.estimated_contract_value ?? ""}
            className={inputClass}
          />
        </label>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Dates &amp; status</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            Tender closing date
            <input type="date" name="tenderClosingDate" defaultValue={project?.tender_closing_date ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Award date
            <input type="date" name="awardDate" defaultValue={project?.award_date ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Status
            <select name="status" defaultValue={project?.status ?? "draft"} className={inputClass}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status[0].toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          Notes
          <textarea name="notes" rows={4} defaultValue={project?.notes ?? ""} className={textareaClass} />
        </label>
      </section>

      <SubmitButton pendingText="Saving..." className="w-fit">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
