"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialActionState);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.email && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.email[0]}
          </span>
        )}
      </label>

      <SubmitButton pendingText="Sending link..." className="mt-2 w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
