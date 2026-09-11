import type { ExportLineItem, KeyItemFlag } from "./types";

const TOP_AMOUNT_ITEM_COUNT = 10;
/** A row's own tender value is "material" once it's at least this share of the whole BOQ. */
const MATERIALITY_SHARE = 0.01;
/** Coefficient of variation (stddev/avg) above this is "unusually high" historical price spread. */
const HIGH_VARIATION_COEFFICIENT = 0.25;

const PROVISIONAL_SUM_KEYWORDS = ["provisional sum", "pc sum", "p.c. sum", "prime cost sum", "prime cost item", "provide the sum of", "allow the sum of"];

// Same keyword-list style as historical-boq/categoriser.ts's CATEGORY_KEYWORDS
// — deterministic, no AI — but tuned for "commercially risky to price wrong"
// rather than trade classification. One match is enough to flag an item;
// this is a lower bar than category classification on purpose.
export const SPECIALIST_KEYWORD_FLAGS: { keyword: string; why: string }[] = [
  { keyword: "pump", why: "Pumps are frequently a specific branded/specialist product with capacity- and brand-dependent pricing." },
  { keyword: "generator", why: "Generators vary significantly in price by capacity, brand, and fuel type." },
  { keyword: "distribution board", why: "Distribution boards are specialist electrical equipment with brand- and spec-dependent pricing." },
  { keyword: "solar", why: "Solar equipment (panels, inverters, batteries) has volatile, brand-dependent pricing." },
  { keyword: "structural steel", why: "Structural steel pricing is sensitive to current market steel prices." },
  { keyword: "sanitaryware", why: "Sanitaryware can range widely in price by brand/model." },
  { keyword: "wash hand basin", why: "Sanitary-ware item — price can range widely by brand/model." },
  { keyword: "wc pan", why: "Sanitary-ware item — price can range widely by brand/model." },
  { keyword: "imported", why: "Imported items are exposed to exchange-rate and shipping-cost volatility." },
  { keyword: "specialist", why: "Explicitly described as a specialist item in the BOQ." },
];

function tenderValue(item: ExportLineItem): number {
  if (item.originalRate !== null && item.quantity !== null) return item.originalRate * item.quantity;
  return item.amount ?? 0;
}

/**
 * Analyses the actual BOQ (not a generic checklist, per spec §5) for
 * commercially important or risky items and explains, per item, what it is,
 * why it matters, what kind of risk it is, and what to do about it. A single
 * item can accumulate more than one flag (e.g. high amount AND weak
 * evidence) — each is reported separately since the reasons are distinct.
 */
export function flagKeyItems(lineItems: ExportLineItem[]): KeyItemFlag[] {
  const flags: KeyItemFlag[] = [];
  const totalTenderValue = lineItems.reduce((sum, item) => sum + tenderValue(item), 0);
  const materialityThreshold = totalTenderValue * MATERIALITY_SHARE;

  // "High amount" is relative to the whole BOQ, not just rank: with only a
  // handful of items, being #1 by value doesn't mean much on its own — it
  // must also clear the materiality threshold to count as commercially
  // significant.
  const byValueDesc = lineItems
    .map((item) => ({ item, value: item.amount ?? tenderValue(item) }))
    .filter((x) => x.value >= materialityThreshold && x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_AMOUNT_ITEM_COUNT);

  for (const { item, value } of byValueDesc) {
    const share = totalTenderValue > 0 ? `${((value / totalTenderValue) * 100).toFixed(1)}% of total BOQ value` : "a large share of this BOQ's value";
    flags.push({
      itemId: item.id,
      itemCode: item.itemCode,
      description: item.description,
      amount: item.amount,
      reasonCategory: "price_magnitude",
      what: item.description,
      why: `One of the highest-value items in this BOQ (${share}) — an error here has an outsized effect on the tender total.`,
      recommendedAction: "Double-check the quantity, rate, and specification against the drawings before submitting.",
    });
  }

  for (const item of lineItems) {
    const text = item.description.toLowerCase();
    if (PROVISIONAL_SUM_KEYWORDS.some((keyword) => text.includes(keyword))) {
      flags.push({
        itemId: item.id,
        itemCode: item.itemCode,
        description: item.description,
        amount: item.amount,
        reasonCategory: "provisional_sum",
        what: item.description,
        why: "Described as a provisional or prime cost sum — the true final cost is not yet known and is excluded from firm pricing.",
        recommendedAction: "Confirm whether this sum needs adjusting before submission and how it will be reconciled at final account.",
      });
    }
  }

  for (const item of lineItems) {
    const text = item.description.toLowerCase();
    const match = SPECIALIST_KEYWORD_FLAGS.find(({ keyword }) => text.includes(keyword));
    if (match) {
      flags.push({
        itemId: item.id,
        itemCode: item.itemCode,
        description: item.description,
        amount: item.amount,
        reasonCategory: "brand_dependence",
        what: item.description,
        why: match.why,
        recommendedAction: "Get a current supplier quote for the exact specified brand/model before tendering.",
      });
    }
  }

  for (const item of lineItems) {
    const match = item.benchmarkEvidence?.bestMatch;
    if (match?.avgRate && match.avgRate > 0 && match.stddevRate !== null && match.stddevRate !== undefined) {
      const coefficientOfVariation = match.stddevRate / match.avgRate;
      if (coefficientOfVariation >= HIGH_VARIATION_COEFFICIENT) {
        flags.push({
          itemId: item.id,
          itemCode: item.itemCode,
          description: item.description,
          amount: item.amount,
          reasonCategory: "market_volatility",
          what: item.description,
          why: `Historical rates for similar items vary widely (spread of roughly ±${Math.round(coefficientOfVariation * 100)}% around the average) — past pricing for this kind of item has not been consistent.`,
          recommendedAction: "Treat the historical benchmark as indicative only; get a current quote to confirm the rate.",
        });
      }
    }
  }

  for (const item of lineItems) {
    if (item.marketEvidence?.highVariance) {
      flags.push({
        itemId: item.id,
        itemCode: item.itemCode,
        description: item.description,
        amount: item.amount,
        reasonCategory: "market_volatility",
        what: item.description,
        why: "Current market sources for this item disagree materially on price — supplier quotes for comparable material varied more than would be expected for a consistent product.",
        recommendedAction: "Treat the market baseline as indicative only; get a current supplier quote to confirm the rate.",
      });
    }
  }

  for (const item of lineItems) {
    const isWeakOrNone = item.confidence === "review_required" || item.confidence === "low";
    if (isWeakOrNone && tenderValue(item) >= materialityThreshold && tenderValue(item) > 0) {
      flags.push({
        itemId: item.id,
        itemCode: item.itemCode,
        description: item.description,
        amount: item.amount,
        reasonCategory: "limited_evidence",
        what: item.description,
        why: "A materially significant item with limited or no supporting evidence for its rate.",
        recommendedAction: "Source a current quote or a comparable historical rate before finalising this item's price.",
      });
    }
  }

  return flags;
}
