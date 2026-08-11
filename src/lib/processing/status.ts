import type { ProcessingJobStatus } from "@/types/database.types";

// Order defines both display order and the implied progress percentage on
// the Processing Screen. No queue worker exists yet, so most jobs will sit
// at QUEUED — the remaining stages are modeled for the future AI pipeline.
export const processingStageOrder: ProcessingJobStatus[] = [
  "UPLOADED",
  "WAITING_FOR_PAYMENT",
  "PAYMENT_VERIFIED",
  "QUEUED",
  "PREPARING_DOCUMENT",
  "AI_EXTRACTION",
  "NORMALISING_DATA",
  "BENCHMARKING",
  "RATE_RECOMMENDATION",
  "GENERATING_EXPORT",
  "COMPLETED",
];

export const processingStageLabels: Record<ProcessingJobStatus, string> = {
  UPLOADED: "Upload complete",
  WAITING_FOR_PAYMENT: "Waiting for payment",
  PAYMENT_VERIFIED: "Payment verified",
  QUEUED: "Queued for processing",
  PREPARING_DOCUMENT: "Preparing document",
  AI_EXTRACTION: "Extracting BOQ",
  NORMALISING_DATA: "Normalising data",
  BENCHMARKING: "Building benchmark",
  RATE_RECOMMENDATION: "Generating pricing",
  GENERATING_EXPORT: "Creating export",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function processingProgressPercent(status: ProcessingJobStatus): number {
  if (status === "FAILED" || status === "CANCELLED") return 0;
  const index = processingStageOrder.indexOf(status);
  if (index === -1) return 0;
  return Math.round((index / (processingStageOrder.length - 1)) * 100);
}
