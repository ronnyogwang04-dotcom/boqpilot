import Link from "next/link";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { ProjectWorkflowResult, ProjectWorkflowStep } from "@/lib/project-workflow/status";

const stepLabels: Record<ProjectWorkflowStep["id"], string> = {
  project_setup: "Project setup",
  boq_uploaded: "BOQ uploaded",
  payment: "Payment",
  historical_evidence: "Historical evidence",
  pricing: "Pricing",
  estimator_review: "Estimator review",
  excel_export: "Excel export",
};

function StepIcon({ state }: { state: ProjectWorkflowStep["state"] }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (state === "current") return <CircleDot className="h-4 w-4 shrink-0 text-zinc-900 dark:text-white" />;
  return <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-700" />;
}

export function ProjectWorkflowStepper({
  result,
  hrefFor,
}: {
  result: ProjectWorkflowResult;
  hrefFor: (key: ProjectWorkflowResult["primaryCta"]["key"]) => string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <ol className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        {result.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2">
            <StepIcon state={step.state} />
            <div>
              <p
                className={
                  step.state === "upcoming"
                    ? "text-zinc-400 dark:text-zinc-600"
                    : "font-medium text-zinc-900 dark:text-white"
                }
              >
                {stepLabels[step.id]}
              </p>
              {step.detail && <p className="text-xs text-zinc-500">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.explanatoryCopy}</p>
        <div className="flex shrink-0 gap-2">
          {result.secondaryCta && (
            <Link
              href={hrefFor(result.secondaryCta.key)}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
            >
              {result.secondaryCta.label}
            </Link>
          )}
          <Link
            href={hrefFor(result.primaryCta.key)}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {result.primaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
