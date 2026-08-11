export interface PricingContext {
  pageCount: number;
  isFreeTrialEligible: boolean;
}

export interface PricingResult {
  /** Tier id from config, or "free"/"enterprise" for those special cases. */
  tier: string;
  price: number;
  currency: string;
  isFree: boolean;
  /** True when no automatic price applies — display the enterprise message instead. */
  isEnterprise: boolean;
  label: string;
  enterpriseMessage?: string;
}

/**
 * A pricing strategy turns a context (page count today; item count, coupon,
 * subscription interval, etc. in future strategies) into a price. Swapping
 * strategies never requires changing PricingEngine's callers.
 */
export interface PricingStrategy {
  readonly name: string;
  calculate(context: PricingContext): PricingResult;
}
