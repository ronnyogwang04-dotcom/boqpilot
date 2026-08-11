import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Link expired or invalid</h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        This link is no longer valid. Request a new one and try again.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Back to log in
        </Link>
        <Link
          href="/forgot-password"
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Reset password
        </Link>
      </div>
    </div>
  );
}
