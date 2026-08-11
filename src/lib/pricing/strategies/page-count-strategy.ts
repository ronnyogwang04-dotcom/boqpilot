import { pricingConfig } from "@/config/pricing";
import type { PricingContext, PricingResult, PricingStrategy } from "../types";

export class PageCountPricingStrategy implements PricingStrategy {
  readonly name = "page-count";

  calculate(context: PricingContext): PricingResult {
    const { pageCount, isFreeTrialEligible } = context;

    if (isFreeTrialEligible && pageCount <= pricingConfig.freeTrial.maxPages) {
      return {
        tier: "free",
        price: 0,
        currency: pricingConfig.currency,
        isFree: true,
        isEnterprise: false,
        label: "Free trial",
      };
    }

    const tier = pricingConfig.pageTiers.find(
      (t) => pageCount >= t.minPages && pageCount <= t.maxPages,
    );

    if (!tier) {
      return {
        tier: "enterprise",
        price: 0,
        currency: pricingConfig.currency,
        isFree: false,
        isEnterprise: true,
        label: "Enterprise",
        enterpriseMessage: pricingConfig.enterpriseMessage,
      };
    }

    return {
      tier: tier.id,
      price: tier.price,
      currency: pricingConfig.currency,
      isFree: false,
      isEnterprise: false,
      label: tier.label,
    };
  }
}
