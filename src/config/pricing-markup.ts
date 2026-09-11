export type MarkupSettings = {
  wastagePercent: number;
  siteOverheadPercent: number;
  headOfficeOverheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
};

// Proposed defaults — not asserted as correct, editable by any organisation
// member from /dashboard/settings. Applied only when no row exists yet.
export const defaultMarkupSettings: MarkupSettings = {
  wastagePercent: 5,
  siteOverheadPercent: 8,
  headOfficeOverheadPercent: 5,
  profitPercent: 10,
  contingencyPercent: 0,
};
