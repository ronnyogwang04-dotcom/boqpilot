import type { EmbeddingStatus } from "@/lib/embeddings/eligibility";
import { cn } from "@/lib/utils";

const LABELS: Record<EmbeddingStatus, string> = {
  pending: "Pending",
  current: "Embedded",
  stale: "Stale",
  failed: "Failed",
};

const CLASSES: Record<EmbeddingStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  current: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  stale: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function EmbeddingStatusBadge({ status }: { status: EmbeddingStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", CLASSES[status])}>
      {LABELS[status]}
    </span>
  );
}
