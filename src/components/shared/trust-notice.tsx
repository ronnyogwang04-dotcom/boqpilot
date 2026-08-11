import { ShieldCheck } from "lucide-react";

const points = [
  "Your BOQs are encrypted.",
  "Your historical pricing information remains private to your organisation.",
  "No project information is shared with other contractors.",
  "BOQPilot only uses your uploaded information to provide services within your own account.",
];

export function TrustNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
