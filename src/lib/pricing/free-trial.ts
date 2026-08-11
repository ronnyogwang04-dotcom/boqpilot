import { pricingConfig } from "@/config/pricing";

/**
 * A BOQ qualifies for the free trial only if the user has never used it
 * before AND the document is within the free trial's page cap. Page count is
 * checked again by the pricing strategy itself — this only decides
 * eligibility to attempt it.
 */
export function isFreeTrialEligible(
  profile: { free_boq_used: boolean },
  pageCount: number,
): boolean {
  return !profile.free_boq_used && pageCount <= pricingConfig.freeTrial.maxPages;
}
