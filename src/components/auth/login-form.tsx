"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/types/action-state";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const justReset = searchParams.get("reset") === "success";
  const [state, formAction] = useActionState(login, initialActionState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {justReset && (
        <Alert variant="success">Your password has been updated. Log in below.</Alert>
      )}
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

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="flex items-center justify-between">
          Password
          <Link href="/forgot-password" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Forgot password?
          </Link>
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="h-10 rounded-md border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.password && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.password[0]}
          </span>
        )}
      </label>

      <SubmitButton pendingText="Logging in..." className="mt-2 w-full">
        Log in
      </SubmitButton>
    </form>
  );
}
