export default function DashboardOverviewLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 h-40 rounded-lg border border-zinc-200 dark:border-zinc-800" />
      <div className="mt-6 h-24 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700" />
    </div>
  );
}
