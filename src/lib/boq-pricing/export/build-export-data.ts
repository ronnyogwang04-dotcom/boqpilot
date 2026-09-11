import { resolveExportLineItem } from "./pricing-method";
import { buildWorkGroupSummary } from "./work-groups";
import { flagKeyItems } from "./key-item-flags";
import { buildEstimatorReportSummary } from "./estimator-report";
import { buildPricingNotes } from "./pricing-notes";
import type { ExportLineItemInput, ExportWorkbookData, MarkupDefaults } from "./types";

export type ExportMeta = {
  projectName: string;
  boqName: string;
  dateProcessed: string;
};

/**
 * Orchestrates the whole export data pipeline: resolves every raw line item
 * into its final pricing method/confidence/breakdown, then derives the
 * report summary, work-group ranking, key-item flags, and pricing notes
 * from those same resolved items — so every sheet in the workbook agrees
 * with every other sheet, since they all read from one resolved list.
 */
export function buildExportData(rawItems: ExportLineItemInput[], meta: ExportMeta, markupDefaults: MarkupDefaults): ExportWorkbookData {
  const lineItems = rawItems.map(resolveExportLineItem);

  return {
    projectName: meta.projectName,
    boqName: meta.boqName,
    report: buildEstimatorReportSummary(lineItems, meta),
    lineItems,
    workGroups: buildWorkGroupSummary(lineItems),
    keyItemFlags: flagKeyItems(lineItems),
    pricingNotes: buildPricingNotes(lineItems, markupDefaults),
    markupDefaults,
  };
}
