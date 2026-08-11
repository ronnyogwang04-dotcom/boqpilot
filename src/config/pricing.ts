// Single source of truth for page-based BOQ pricing. Adjust tiers, the free
// trial cap, or the enterprise threshold here — no business logic to touch.

export type PageTier = {
  id: string;
  minPages: number;
  maxPages: number;
  price: number;
  label: string;
};

export const pricingConfig = {
  currency: "ZAR" as const,

  // A user's first BOQ is free if it's within this page count.
  freeTrial: {
    maxPages: 20,
  },

  // Page count ranges are inclusive of both bounds and must be contiguous.
  pageTiers: [
    { id: "tier_1_20", minPages: 1, maxPages: 20, price: 49, label: "1-20 pages" },
    { id: "tier_21_50", minPages: 21, maxPages: 50, price: 99, label: "21-50 pages" },
    { id: "tier_51_100", minPages: 51, maxPages: 100, price: 199, label: "51-100 pages" },
    { id: "tier_101_250", minPages: 101, maxPages: 250, price: 349, label: "101-250 pages" },
  ] satisfies PageTier[],

  // Above the last tier's maxPages: no automatic price, contact sales.
  enterpriseMessage: "Please contact us for Enterprise Pricing.",

  // Used only to display an estimate on the BOQ Summary page.
  estimatedSecondsPerPage: 5,

  // Upload guardrail — unrelated to pricing tiers, just a sane request-body limit.
  maxUploadSizeMb: 20,
};

/** Human-readable label for a stored pricing_tier id ("free", "enterprise", or a page tier id). */
export function getPricingTierLabel(tierId: string): string {
  if (tierId === "free") return "Free trial";
  if (tierId === "enterprise") return "Enterprise";
  return pricingConfig.pageTiers.find((t) => t.id === tierId)?.label ?? tierId;
}
