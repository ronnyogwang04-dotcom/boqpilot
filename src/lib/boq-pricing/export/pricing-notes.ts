import type { ExportLineItem, MarkupDefaults, PricingNote } from "./types";

/**
 * BOQ-specific observations (spec §6) — every note is derived from counting
 * the actual resolved line items, never generic boilerplate unrelated to
 * this BOQ.
 */
export function buildPricingNotes(lineItems: ExportLineItem[], markupDefaults: MarkupDefaults): PricingNote[] {
  const notes: PricingNote[] = [];

  const historicalCount = lineItems.filter((item) => item.pricingMethodKind === "historical").length;
  if (historicalCount > 0) {
    notes.push({
      category: "Historical evidence",
      detail: `${historicalCount} item(s) priced directly from historical BOQ benchmark evidence.`,
    });
  }

  const buildUpCount = lineItems.filter((item) => item.pricingMethodKind === "build_up").length;
  if (buildUpCount > 0) {
    notes.push({
      category: "Cost build-up",
      detail: `${buildUpCount} item(s) priced from a material/labour/plant/overhead/profit cost build-up entered by the estimator.`,
    });
  }

  const weakEvidenceItems = lineItems.filter((item) => item.confidence === "low" || item.confidence === "review_required");
  if (weakEvidenceItems.length > 0) {
    const examples = weakEvidenceItems.slice(0, 5).map((item) => item.itemCode ?? item.description.slice(0, 40)).join(", ");
    notes.push({
      category: "Weak or missing evidence",
      detail: `${weakEvidenceItems.length} item(s) have limited or no supporting evidence for their rate (e.g. ${examples}) — see the Review & Double-Check sheet.`,
    });
  }

  const unpricedItems = lineItems.filter((item) => !item.isConfirmed);
  if (unpricedItems.length > 0) {
    notes.push({
      category: "Not yet reviewed",
      detail: `${unpricedItems.length} item(s) have not been explicitly reviewed and confirmed by the estimator — the rate shown is BOQPilot's system suggestion only, where evidence allowed one.`,
    });
  }

  const missingUnitItems = lineItems.filter((item) => !item.unit);
  if (missingUnitItems.length > 0) {
    notes.push({
      category: "Missing unit",
      detail: `${missingUnitItems.length} item(s) have no unit recorded in the source BOQ — verify against the original document before pricing.`,
    });
  }

  const missingQuantityItems = lineItems.filter((item) => item.quantity === null);
  if (missingQuantityItems.length > 0) {
    notes.push({
      category: "Missing quantity",
      detail: `${missingQuantityItems.length} item(s) have no quantity recorded — amount cannot be calculated for these until quantity is confirmed.`,
    });
  }

  if (buildUpCount > 0) {
    notes.push({
      category: "Markup assumptions",
      detail: `Cost build-up items used these organisation default markups unless overridden per item: wastage ${markupDefaults.wastagePercent}%, site overhead ${markupDefaults.siteOverheadPercent}%, head office overhead ${markupDefaults.headOfficeOverheadPercent}%, contingency ${markupDefaults.contingencyPercent}%, profit ${markupDefaults.profitPercent}%.`,
    });
  }

  const onlineCount = lineItems.filter((item) => item.pricingMethodKind === "online").length;
  const highVarianceCount = lineItems.filter((item) => item.marketEvidence?.highVariance).length;
  if (onlineCount > 0) {
    notes.push({
      category: "Current market / material research",
      detail: `${onlineCount} item(s) priced from current South African market/material research evidence — see the Sources and Research sheet for supplier, price, VAT status, and source link per item. Market research is evidence for the estimator to weigh, not an automatically-applied rate.`,
    });
  } else {
    notes.push({
      category: "Current market / material research",
      detail: "No item in this BOQ has a saved rate sourced from current market/material research yet. Where historical evidence is weak or absent, use \"Research market price\" on the item to search current South African suppliers.",
    });
  }
  if (highVarianceCount > 0) {
    notes.push({
      category: "Market price variation",
      detail: `${highVarianceCount} item(s) show high variation across current market sources — treat the market baseline as indicative only and confirm with a supplier quote.`,
    });
  }

  return notes;
}
