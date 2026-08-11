"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, initialActionState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.password && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.password[0]}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Confirm new password
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.confirmPassword && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.confirmPassword[0]}
          </span>
        )}
      </label>

      <SubmitButton pendingText="Updating..." className="mt-2 w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
