import type { ProcessingJobStatus } from "@/types/database.types";

/**
 * Pure, DB-free computation of "what should the project workspace show right
 * now" — the stepper state and the single next-action CTA. Kept free of
 * routing/Supabase concerns so it's trivially unit-testable; the page
 * component maps the logical `key` on each CTA to a real href.
 *
 * Deliberately does NOT invent new processing_jobs statuses: extraction
 * progress comes from the real ProcessingJobStatus enum, and "pricing
 * progress" is derived from counts (see getBoqPricingProgress), not a new
 * status value — BENCHMARKING/RATE_RECOMMENDATION/GENERATING_EXPORT stay
 * unused, matching current reality (see src/lib/boq-pricing/process-boq.ts).
 */

export type ProjectWorkflowStepId =
  | "project_setup"
  | "boq_uploaded"
  | "payment"
  | "historical_evidence"
  | "pricing"
  | "estimator_review"
  | "excel_export";

export type ProjectWorkflowStepState = "done" | "current" | "upcoming";

export type ProjectWorkflowStep = {
  id: ProjectWorkflowStepId;
  state: ProjectWorkflowStepState;
  detail?: string;
};

export type ProjectWorkflowCtaKey =
  | "upload"
  | "pay"
  | "processing"
  | "add-history"
  | "price"
  | "export"
  | "enterprise-contact";

export type ProjectWorkflowCta = {
  key: ProjectWorkflowCtaKey;
  label: string;
};

export type ProjectWorkflowCase = "A" | "B" | "B_ENTERPRISE" | "B_PROCESSING" | "C" | "D" | "E" | "F";

export type ProjectWorkflowResult = {
  case: ProjectWorkflowCase;
  steps: ProjectWorkflowStep[];
  primaryCta: ProjectWorkflowCta;
  secondaryCta: ProjectWorkflowCta | null;
  explanatoryCopy: string;
};

export type ProjectWorkflowInput = {
  hasCurrentBoq: boolean;
  jobStatus: ProcessingJobStatus | null;
  isEnterpriseTier: boolean;
  historicalBoqCount: number;
  pricingProgress: { totalRateItems: number; pricedRateItems: number } | null;
};

function steps(overrides: Partial<Record<ProjectWorkflowStepId, ProjectWorkflowStep>>): ProjectWorkflowStep[] {
  const order: ProjectWorkflowStepId[] = [
    "project_setup",
    "boq_uploaded",
    "payment",
    "historical_evidence",
    "pricing",
    "estimator_review",
    "excel_export",
  ];
  return order.map((id) => overrides[id] ?? { id, state: "upcoming" });
}

export function computeProjectWorkflowStatus(input: ProjectWorkflowInput): ProjectWorkflowResult {
  const { hasCurrentBoq, jobStatus, isEnterpriseTier, historicalBoqCount } = input;
  const historyDetail =
    historicalBoqCount > 0
      ? `${historicalBoqCount} historical BOQ${historicalBoqCount === 1 ? "" : "s"} available`
      : "No historical BOQs yet";

  if (!hasCurrentBoq || jobStatus === null) {
    return {
      case: "A",
      steps: steps({ project_setup: { id: "project_setup", state: "done" } }),
      primaryCta: { key: "upload", label: "Upload BOQ to Price" },
      secondaryCta: null,
      explanatoryCopy: "Upload the BOQ you want BOQPilot to price to get started.",
    };
  }

  if (jobStatus === "WAITING_FOR_PAYMENT") {
    if (isEnterpriseTier) {
      return {
        case: "B_ENTERPRISE",
        steps: steps({
          project_setup: { id: "project_setup", state: "done" },
          boq_uploaded: { id: "boq_uploaded", state: "done" },
          payment: { id: "payment", state: "current", detail: "Enterprise pricing — contact us" },
        }),
        primaryCta: { key: "enterprise-contact", label: "Contact Us" },
        secondaryCta: null,
        explanatoryCopy: "This BOQ is priced at the enterprise tier — contact us to proceed.",
      };
    }
    return {
      case: "B",
      steps: steps({
        project_setup: { id: "project_setup", state: "done" },
        boq_uploaded: { id: "boq_uploaded", state: "done" },
        payment: { id: "payment", state: "current" },
      }),
      primaryCta: { key: "pay", label: "Continue to Payment" },
      secondaryCta: null,
      explanatoryCopy: "Complete payment to start processing this BOQ.",
    };
  }

  if (jobStatus !== "COMPLETED") {
    // Everything between payment and COMPLETED (QUEUED, PREPARING_DOCUMENT,
    // AI_EXTRACTION, NORMALISING_DATA, and terminal FAILED/CANCELLED) is
    // "processing underway or needs attention" — the /processing page
    // already renders the right detail (progress bar or failure reason) for
    // each of these, so this case just points there rather than duplicating
    // that logic.
    return {
      case: "B_PROCESSING",
      steps: steps({
        project_setup: { id: "project_setup", state: "done" },
        boq_uploaded: { id: "boq_uploaded", state: "done" },
        payment: { id: "payment", state: "done" },
        pricing: { id: "pricing", state: "current", detail: "Extraction in progress" },
      }),
      primaryCta: { key: "processing", label: "View Processing Status" },
      secondaryCta: null,
      explanatoryCopy: "BOQPilot is extracting line items from your BOQ.",
    };
  }

  // jobStatus === "COMPLETED" from here on — extraction is done, pricing is
  // the only thing left, and pricing progress is derived from real
  // boq_line_items counts (getBoqPricingProgress), never a fake status.
  const progress = input.pricingProgress ?? { totalRateItems: 0, pricedRateItems: 0 };
  const doneThroughExtraction = {
    project_setup: { id: "project_setup" as const, state: "done" as const },
    boq_uploaded: { id: "boq_uploaded" as const, state: "done" as const },
    payment: { id: "payment" as const, state: "done" as const },
  };

  if (progress.totalRateItems > 0 && progress.pricedRateItems === progress.totalRateItems) {
    return {
      case: "F",
      steps: steps({
        ...doneThroughExtraction,
        historical_evidence: { id: "historical_evidence", state: "done", detail: historyDetail },
        pricing: { id: "pricing", state: "done" },
        estimator_review: { id: "estimator_review", state: "done", detail: "All items priced" },
        excel_export: { id: "excel_export", state: "current" },
      }),
      primaryCta: { key: "export", label: "Download Excel" },
      secondaryCta: null,
      explanatoryCopy: "Every item has a rate. Your priced BOQ is ready to export.",
    };
  }

  if (progress.pricedRateItems > 0) {
    return {
      case: "E",
      steps: steps({
        ...doneThroughExtraction,
        historical_evidence: { id: "historical_evidence", state: "done", detail: historyDetail },
        pricing: { id: "pricing", state: "current" },
        estimator_review: {
          id: "estimator_review",
          state: "current",
          detail: `${progress.pricedRateItems} of ${progress.totalRateItems} items priced`,
        },
      }),
      primaryCta: { key: "price", label: "Continue Pricing" },
      secondaryCta: null,
      explanatoryCopy: `${progress.pricedRateItems} of ${progress.totalRateItems} items priced so far.`,
    };
  }

  if (historicalBoqCount > 0) {
    return {
      case: "D",
      steps: steps({
        ...doneThroughExtraction,
        historical_evidence: { id: "historical_evidence", state: "done", detail: historyDetail },
        pricing: { id: "pricing", state: "current" },
      }),
      primaryCta: { key: "price", label: "Price This BOQ" },
      secondaryCta: { key: "add-history", label: "Add More Historical BOQs" },
      explanatoryCopy: `${historyDetail} for benchmarking. Ready to price this BOQ.`,
    };
  }

  return {
    case: "C",
    steps: steps({
      ...doneThroughExtraction,
      historical_evidence: { id: "historical_evidence", state: "current", detail: historyDetail },
    }),
    primaryCta: { key: "add-history", label: "Add Historical BOQs" },
    secondaryCta: { key: "price", label: "Continue Without Historical BOQs" },
    explanatoryCopy:
      "Historical BOQs let BOQPilot benchmark this tender against your previous rates. Upload one or several now, or continue using market research and manual pricing.",
  };
}
