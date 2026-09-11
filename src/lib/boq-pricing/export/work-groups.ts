import type { ExportLineItem, WorkGroupSummary } from "./types";

/**
 * Groups already-classified line items (category_division, computed once by
 * the existing extraction pipeline — never recomputed here) by division and
 * ranks by financial impact, per spec §4: "indicate which work groups have
 * the largest financial impact and/or largest number of items." Divisions
 * are whatever the actual BOQ produced, not a fixed hardcoded list.
 */
export function buildWorkGroupSummary(lineItems: ExportLineItem[]): WorkGroupSummary[] {
  const byDivision = new Map<string, WorkGroupSummary>();

  for (const item of lineItems) {
    const division = item.categoryDivision;
    const existing = byDivision.get(division) ?? {
      division,
      itemCount: 0,
      totalAmount: 0,
      pricedItemCount: 0,
      reviewRequiredCount: 0,
    };

    existing.itemCount += 1;
    existing.totalAmount += item.amount ?? 0;
    if (item.isConfirmed) existing.pricedItemCount += 1;
    if (item.confidence === "review_required") existing.reviewRequiredCount += 1;

    byDivision.set(division, existing);
  }

  return [...byDivision.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}
