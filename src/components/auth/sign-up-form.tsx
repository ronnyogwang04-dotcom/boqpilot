"use client";

import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function SignUpForm() {
  const [state, formAction] = useActionState(signup, initialActionState);

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state.status === "error" && state.message && <Alert>{state.message}</Alert>}

      <label className="flex flex-col gap-1.5 text-sm">
        Full name
        <input
          type="text"
          name="fullName"
          required
          autoComplete="name"
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.fullName && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.fullName[0]}
          </span>
        )}
      </label>

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

      <label className="flex flex-col gap-1.5 text-sm">
        Password
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

      <SubmitButton pendingText="Creating account..." className="mt-2 w-full">
        Sign up
      </SubmitButton>
    </form>
  );
}
