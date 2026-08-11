"use client";

import { useActionState } from "react";
import { updateCanonicalItem } from "@/lib/actions/canonical-items";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function CanonicalItemEditForm({
  itemId,
  normalisedDescription,
  normalisedUnit,
  division,
  category,
  adminNotes,
  divisions,
  categories,
}: {
  itemId: string;
  normalisedDescription: string;
  normalisedUnit: string;
  division: string;
  category: string;
  adminNotes: string;
  divisions: string[];
  categories: string[];
}) {
  const action = updateCanonicalItem.bind(null, itemId);
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Description
        <textarea
          name="normalisedDescription"
          defaultValue={normalisedDescription}
          required
          rows={2}
          className={inputClass}
        />
        {state.fieldErrors?.normalisedDescription && (
          <span className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.normalisedDescription[0]}</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Unit
          <input type="text" name="normalisedUnit" defaultValue={normalisedUnit} required className={inputClass} />
        </label>

        <div />

        <label className="flex flex-col gap-1.5 text-sm">
          Division
          <select name="division" defaultValue={division} required className={inputClass}>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Category
          <select name="category" defaultValue={category} required className={inputClass}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        Admin notes
        <textarea
          name="adminNotes"
          defaultValue={adminNotes}
          rows={2}
          placeholder="Why this was corrected, or anything worth flagging..."
          className={inputClass}
        />
      </label>

      <SubmitButton pendingText="Saving..." className="self-start">
        Save correction
      </SubmitButton>
    </form>
  );
}
