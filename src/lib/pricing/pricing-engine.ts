import { PageCountPricingStrategy } from "./strategies/page-count-strategy";
import type { PricingContext, PricingResult, PricingStrategy } from "./types";

export class PricingEngine {
  constructor(private readonly strategy: PricingStrategy) {}

  calculatePrice(context: PricingContext): PricingResult {
    return this.strategy.calculate(context);
  }
}

let engine: PricingEngine | undefined;

// Single seam the app depends on. Swapping the active pricing strategy (e.g.
// item-count, subscription, coupon-adjusted) means constructing a different
// PricingEngine here — nothing else in the app needs to change.
export function getPricingEngine(): PricingEngine {
  if (!engine) {
    engine = new PricingEngine(new PageCountPricingStrategy());
  }
  return engine;
}
