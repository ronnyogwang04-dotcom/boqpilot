"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function ProfileSettingsForm({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const [state, formAction] = useActionState(updateProfile, initialActionState);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "success" && !dismissed && (
        <Alert variant="success">{state.message}</Alert>
      )}
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input
          type="email"
          value={email}
          disabled
          className="h-10 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Full name
        <input
          type="text"
          name="fullName"
          required
          defaultValue={fullName}
          onChange={() => setDismissed(true)}
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.fullName && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.fullName[0]}
          </span>
        )}
      </label>

      <SubmitButton pendingText="Saving..." className="w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}
