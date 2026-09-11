"use client";

import { useActionState } from "react";
import { saveMarkupSettings } from "@/lib/actions/pricing-settings";
import type { MarkupSettings } from "@/lib/actions/pricing-settings";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

const FIELDS: { key: keyof MarkupSettings; name: string; label: string }[] = [
  { key: "wastagePercent", name: "wastagePercent", label: "Wastage" },
  { key: "siteOverheadPercent", name: "siteOverheadPercent", label: "Site overheads" },
  { key: "headOfficeOverheadPercent", name: "headOfficeOverheadPercent", label: "Head office overheads" },
  { key: "profitPercent", name: "profitPercent", label: "Profit" },
  { key: "contingencyPercent", name: "contingencyPercent", label: "Contingency" },
];

export function MarkupSettingsForm({ settings }: { settings: MarkupSettings }) {
  const [state, formAction] = useActionState(saveMarkupSettings, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "success" && state.message && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <p className="text-xs text-zinc-500">
        Default percentages used by the cost build-up calculator on each BOQ line item. These are proposed defaults,
        not asserted as correct for your business — adjust them to match your own overheads and pricing policy.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5 text-sm">
            {field.label}
            <div className="flex items-center gap-1">
              <input
                type="number"
                name={field.name}
                min={0}
                max={100}
                step={0.1}
                defaultValue={settings[field.key]}
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-zinc-500">%</span>
            </div>
          </label>
        ))}
      </div>

      <SubmitButton pendingText="Saving..." className="w-fit">
        Save markup defaults
      </SubmitButton>
    </form>
  );
}
