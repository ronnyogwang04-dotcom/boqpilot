// Transparent construction cost build-up — every component and every markup
// step is a separate, visible line, never a single opaque multiplier. Only
// components the estimator actually supplies produce a line: a materials-
// only supply item has no labour/plant lines, a labour-only installation
// item has no material line, etc. — nothing is assumed present.

export type CostBuildupComponents = {
  materialCost?: number | null;
  wastagePercent?: number | null;
  labourCost?: number | null;
  plantCost?: number | null;
  consumablesCost?: number | null;
  transportCost?: number | null;
  subcontractorCost?: number | null;
  otherDirectCost?: number | null;
};

export type CostBuildupMarkups = {
  siteOverheadPercent?: number | null;
  headOfficeOverheadPercent?: number | null;
  contingencyPercent?: number | null;
  profitPercent?: number | null;
};

export type CostBuildupLine = { label: string; amount: number };

export type CostBuildupResult = {
  directCostLines: CostBuildupLine[];
  directCostSubtotal: number;
  markupLines: CostBuildupLine[];
  suggestedRate: number;
};

/**
 * Direct-cost components are summed first (material includes its own
 * wastage% as a separate visible line, applied to material only — wastage
 * on labour/plant doesn't make sense and isn't modelled). Markups are then
 * applied to the direct-cost subtotal in sequence: site overhead, head
 * office overhead, and contingency are each a % of the direct-cost
 * subtotal; profit is applied last, on cost + those markups (the standard
 * cost-plus cascading convention: a contractor prices profit on their total
 * exposure, not on raw material cost alone). Every step is returned as its
 * own line so the UI never has to reverse-engineer how a number was reached.
 */
export function calculateCostBuildup(components: CostBuildupComponents, markups: CostBuildupMarkups): CostBuildupResult {
  const directCostLines: CostBuildupLine[] = [];

  const material = components.materialCost ?? 0;
  if (material > 0) {
    directCostLines.push({ label: "Material", amount: material });
    const wastagePercent = components.wastagePercent ?? 0;
    if (wastagePercent > 0) {
      directCostLines.push({ label: `Wastage (${wastagePercent}%)`, amount: material * (wastagePercent / 100) });
    }
  }

  const componentLabels: [keyof CostBuildupComponents, string][] = [
    ["labourCost", "Labour"],
    ["plantCost", "Plant/equipment"],
    ["consumablesCost", "Consumables/sundries"],
    ["transportCost", "Delivery/transport"],
    ["subcontractorCost", "Subcontractor"],
    ["otherDirectCost", "Other direct costs"],
  ];
  for (const [key, label] of componentLabels) {
    const amount = components[key];
    if (amount) directCostLines.push({ label, amount });
  }

  const directCostSubtotal = directCostLines.reduce((sum, line) => sum + line.amount, 0);

  const markupLines: CostBuildupLine[] = [];
  let runningTotal = directCostSubtotal;

  const percentOfDirectCost: [keyof CostBuildupMarkups, string][] = [
    ["siteOverheadPercent", "Site overheads"],
    ["headOfficeOverheadPercent", "Head office overheads"],
    ["contingencyPercent", "Contingency"],
  ];
  for (const [key, label] of percentOfDirectCost) {
    const percent = markups[key] ?? 0;
    if (percent > 0) {
      const amount = directCostSubtotal * (percent / 100);
      markupLines.push({ label: `${label} (${percent}%)`, amount });
      runningTotal += amount;
    }
  }

  const profitPercent = markups.profitPercent ?? 0;
  if (profitPercent > 0) {
    const amount = runningTotal * (profitPercent / 100);
    markupLines.push({ label: `Profit (${profitPercent}%)`, amount });
    runningTotal += amount;
  }

  return { directCostLines, directCostSubtotal, markupLines, suggestedRate: runningTotal };
}
