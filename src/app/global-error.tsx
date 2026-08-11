"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">Application error</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-600">
          Something went badly wrong. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
