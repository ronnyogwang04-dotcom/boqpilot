import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/payments/types";

const statusClasses: Record<PaymentStatus, string> = {
  complete:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

const statusLabels: Record<PaymentStatus, string> = {
  complete: "Complete",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusClasses[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
