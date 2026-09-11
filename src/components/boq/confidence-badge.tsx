import type { BenchmarkConfidence } from "@/lib/boq-pricing/confidence";
import { CONFIDENCE_LABELS } from "@/lib/boq-pricing/confidence";
import { cn } from "@/lib/utils";

const CLASSES: Record<BenchmarkConfidence, string> = {
  strong: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  reasonable: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  weak: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  none: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

export function ConfidenceBadge({ confidence }: { confidence: BenchmarkConfidence }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", CLASSES[confidence])}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}
