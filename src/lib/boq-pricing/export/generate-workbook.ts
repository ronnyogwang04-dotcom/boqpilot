import ExcelJS from "exceljs";
import { MARKET_EVIDENCE_CLASSIFICATION_LABELS } from "../market-research/types";
import { INTERNATIONAL_REFERENCE_LABEL } from "../market-research/source-origin";
import { CONFIDENCE_LEVEL_LABELS, type ExportLineItem, type ExportWorkbookData, type PricingConfidenceLevel } from "./types";

const ZAR_FORMAT = '"R"#,##0.00';
const PERCENT_FORMAT = "0.0%";

const CONFIDENCE_FILL: Record<PricingConfidenceLevel, string> = {
  high: "FFD9F2D9",
  medium: "FFFFF2CC",
  low: "FFFCE4D6",
  review_required: "FFF8D7DA",
};

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = fill("FFE7E6E6");
  row.alignment = { vertical: "middle", wrapText: true };
}

function addSectionHeading(sheet: ExcelJS.Worksheet, text: string) {
  const row = sheet.addRow([text]);
  row.font = { bold: true, size: 12 };
  sheet.addRow([]);
}

/** Item/description prefix shared by the detail sheets so a row can always be traced back to the Priced BOQ sheet. */
function itemLabel(item: ExportLineItem): string {
  return item.itemCode ? `${item.itemCode} — ${item.description}` : item.description;
}

function addEstimatorReportSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Estimator Report", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 32 }, { width: 22 }, { width: 22 }, { width: 22 }];

  const title = sheet.addRow(["BOQPilot Estimator Report"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);

  addSectionHeading(sheet, "Project information");
  sheet.addRow(["Project name", data.report.projectName]);
  sheet.addRow(["BOQ name", data.report.boqName]);
  sheet.addRow(["Date processed", data.report.dateProcessed]);
  sheet.addRow(["Number of BOQ items", data.report.totalItems]);
  sheet.addRow(["Number of items priced (estimator-confirmed)", data.report.pricedItems]);
  sheet.addRow(["Number requiring review", data.report.reviewRequiredItems]);
  sheet.addRow([]);

  addSectionHeading(sheet, "Pricing summary");
  const summaryRows: [string, number][] = [
    ["Total BOQ value", data.report.totalBoqValue],
    ["Value benchmarked against historical BOQs", data.report.historicalBenchmarkedValue],
    ["Value priced from market/material research", data.report.marketResearchedValue],
    ["Value requiring manual review", data.report.reviewRequiredValue],
  ];
  for (const [label, value] of summaryRows) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = ZAR_FORMAT;
  }
  sheet.addRow(["Items benchmarked against historical BOQs", data.report.historicalBenchmarkedCount]);
  sheet.addRow(["Items priced from market/material research", data.report.marketResearchedCount]);
  sheet.addRow([]);

  addSectionHeading(sheet, "Confidence breakdown");
  const confHeader = sheet.addRow(["Confidence level", "Item count", "Value"]);
  styleHeaderRow(confHeader);
  (["high", "medium", "low", "review_required"] as PricingConfidenceLevel[]).forEach((level) => {
    const breakdown = data.report.confidenceBreakdown[level];
    const row = sheet.addRow([CONFIDENCE_LEVEL_LABELS[level], breakdown.count, breakdown.value]);
    row.getCell(3).numFmt = ZAR_FORMAT;
    if (level === "review_required" && breakdown.count > 0) row.getCell(1).fill = fill(CONFIDENCE_FILL.review_required);
  });
  sheet.addRow([]);

  addSectionHeading(sheet, "Key work groups (ranked by financial impact)");
  const wgHeader = sheet.addRow(["Division", "Item count", "Total amount", "Priced items", "Review required"]);
  styleHeaderRow(wgHeader);
  for (const group of data.workGroups) {
    const row = sheet.addRow([group.division, group.itemCount, group.totalAmount, group.pricedItemCount, group.reviewRequiredCount]);
    row.getCell(3).numFmt = ZAR_FORMAT;
  }
}

function addPricedBoqSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Priced BOQ", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Item Code", key: "itemCode", width: 12 },
    { header: "Description", key: "description", width: 44 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Quantity", key: "quantity", width: 11 },
    { header: "Recommended Rate", key: "recommendedRate", width: 16 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Original Tender Rate", key: "originalRate", width: 16 },
    { header: "Historical Benchmark Rate", key: "historicalBenchmarkRate", width: 18 },
    { header: "Market/Material Cost", key: "marketRate", width: 16 },
    { header: "Labour Allowance", key: "labourAllowance", width: 14 },
    { header: "Plant/Equipment Allowance", key: "plantAllowance", width: 18 },
    { header: "Overheads", key: "overheadsAmount", width: 12 },
    { header: "Profit/Markup", key: "profitAmount", width: 12 },
    { header: "Final Recommended Rate", key: "finalRate", width: 18 },
    { header: "Pricing Source/Method", key: "pricingMethodLabel", width: 34 },
    { header: "Confidence Level", key: "confidence", width: 14 },
    { header: "Division", key: "categoryDivision", width: 18 },
    { header: "Category", key: "constructionCategory", width: 20 },
    { header: "Notes/Flags", key: "notesFlags", width: 36 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const rateColumns = ["recommendedRate", "amount", "originalRate", "historicalBenchmarkRate", "marketRate", "labourAllowance", "plantAllowance", "overheadsAmount", "profitAmount", "finalRate"];

  for (const item of data.lineItems) {
    const notesFlags = [item.notes, ...item.flags].filter(Boolean).join(" | ") || (item.isConfirmed ? "" : "Not yet reviewed by estimator");
    const row = sheet.addRow({
      itemCode: item.itemCode ?? "",
      description: item.description,
      unit: item.unit ?? "",
      quantity: item.quantity,
      recommendedRate: item.recommendedRate,
      amount: item.amount,
      originalRate: item.originalRate,
      historicalBenchmarkRate: item.historicalBenchmarkRate,
      marketRate: item.marketRate,
      labourAllowance: item.labourAllowance,
      plantAllowance: item.plantAllowance,
      overheadsAmount: item.overheadsAmount,
      profitAmount: item.profitAmount,
      finalRate: item.finalRate,
      pricingMethodLabel: item.pricingMethodLabel,
      confidence: CONFIDENCE_LEVEL_LABELS[item.confidence],
      categoryDivision: item.categoryDivision,
      constructionCategory: item.constructionCategory,
      notesFlags,
    });

    for (const key of rateColumns) {
      const cell = row.getCell(sheet.getColumn(key).number);
      cell.numFmt = ZAR_FORMAT;
    }

    const confidenceCell = row.getCell(sheet.getColumn("confidence").number);
    confidenceCell.fill = fill(CONFIDENCE_FILL[item.confidence]);
    if (!item.isConfirmed) {
      row.getCell(sheet.getColumn("notesFlags").number).font = { italic: true, color: { argb: "FF7A7A7A" } };
    }
  }

  const lastRow = sheet.rowCount;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const totalsRow = sheet.addRow({ description: "TOTAL", amount: data.report.totalBoqValue });
  totalsRow.font = { bold: true };
  totalsRow.getCell(sheet.getColumn("amount").number).numFmt = ZAR_FORMAT;
  totalsRow.getCell(sheet.getColumn("amount").number).border = { top: { style: "thin" } };
  totalsRow.getCell(sheet.getColumn("description").number).border = { top: { style: "thin" } };
  void lastRow;
}

function addCostBuildupSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Cost Build-Up Analysis", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Item Code", key: "itemCode", width: 12 },
    { header: "Description", key: "description", width: 40 },
    { header: "Direct Cost Line", key: "lineLabel", width: 26 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Direct Cost Subtotal", key: "subtotal", width: 18 },
    { header: "Suggested Rate", key: "suggestedRate", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const buildUpItems = data.lineItems.filter((item) => item.costBuildupBreakdown !== null);
  if (buildUpItems.length === 0) {
    sheet.addRow(["No items in this BOQ were priced using a cost build-up.", "", "", "", "", ""]);
  }

  for (const item of buildUpItems) {
    const breakdown = item.costBuildupBreakdown!;
    const allLines = [...breakdown.directCostLines, ...breakdown.markupLines];
    allLines.forEach((line, index) => {
      const row = sheet.addRow({
        itemCode: index === 0 ? (item.itemCode ?? "") : "",
        description: index === 0 ? item.description : "",
        lineLabel: line.label,
        amount: line.amount,
        subtotal: index === 0 ? breakdown.directCostSubtotal : null,
        suggestedRate: index === 0 ? breakdown.suggestedRate : null,
      });
      row.getCell(sheet.getColumn("amount").number).numFmt = ZAR_FORMAT;
      if (index === 0) {
        row.getCell(sheet.getColumn("subtotal").number).numFmt = ZAR_FORMAT;
        row.getCell(sheet.getColumn("suggestedRate").number).numFmt = ZAR_FORMAT;
        row.font = { bold: true };
      }
    });
    sheet.addRow([]);
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
}

function addReviewSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Review and Double-Check", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 30 }, { width: 46 }, { width: 20 }, { width: 46 }, { width: 40 }];

  addSectionHeading(sheet, "Commercially significant or risky items");
  const flagHeader = sheet.addRow(["Item", "What it is", "Why it matters", "Reason category", "Recommended action"]);
  styleHeaderRow(flagHeader);
  for (const flag of data.keyItemFlags) {
    const label = flag.itemCode ? `${flag.itemCode} — ${flag.description}` : flag.description;
    sheet.addRow([label, flag.what, flag.why, flag.reasonCategory.replace(/_/g, " "), flag.recommendedAction]);
  }
  sheet.addRow([]);

  addSectionHeading(sheet, "All items requiring review (weak/no evidence or not yet confirmed)");
  const reviewHeader = sheet.addRow(["Item", "Confidence", "Pricing method", "Amount", "Status"]);
  styleHeaderRow(reviewHeader);
  const reviewItems = data.lineItems.filter((item) => item.confidence === "review_required" || !item.isConfirmed);
  for (const item of reviewItems) {
    const row = sheet.addRow([
      itemLabel(item),
      CONFIDENCE_LEVEL_LABELS[item.confidence],
      item.pricingMethodLabel,
      item.amount,
      item.isConfirmed ? "Priced, but low confidence" : "Not yet reviewed by estimator",
    ]);
    row.getCell(4).numFmt = ZAR_FORMAT;
    row.getCell(2).fill = fill(CONFIDENCE_FILL[item.confidence]);
  }
}

function addSourcesSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Sources and Research", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Item", key: "item", width: 40 },
    { header: "Evidence Source", key: "source", width: 22 },
    { header: "Match Description", key: "matchDescription", width: 36 },
    { header: "Similarity", key: "similarity", width: 11 },
    { header: "Samples", key: "samples", width: 10 },
    { header: "Projects", key: "projects", width: 10 },
    { header: "Avg Rate", key: "avgRate", width: 14 },
    { header: "Median Rate", key: "medianRate", width: 14 },
    { header: "Min Rate", key: "minRate", width: 14 },
    { header: "Max Rate", key: "maxRate", width: 14 },
  ];
  styleHeaderRow(sheet.getRow(1));

  for (const item of data.lineItems) {
    const evidence = item.benchmarkEvidence;
    const match = evidence?.bestMatch ?? null;
    const row = sheet.addRow({
      item: itemLabel(item),
      source: evidence ? (item.isConfirmed ? "Historical BOQ benchmark (confirmed)" : "Historical BOQ benchmark (system-suggested)") : "No evidence recorded",
      matchDescription: match?.description ?? "—",
      similarity: match?.similarity ?? null,
      samples: match?.sampleCount ?? null,
      projects: match?.projectCount ?? null,
      avgRate: match?.avgRate ?? null,
      medianRate: match?.medianRate ?? null,
      minRate: match?.minRate ?? null,
      maxRate: match?.maxRate ?? null,
    });
    if (match?.similarity !== undefined && match?.similarity !== null) {
      row.getCell(sheet.getColumn("similarity").number).numFmt = PERCENT_FORMAT;
    }
    for (const key of ["avgRate", "medianRate", "minRate", "maxRate"]) {
      row.getCell(sheet.getColumn(key).number).numFmt = ZAR_FORMAT;
    }
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  sheet.addRow([]);
  addSectionHeading(sheet, "Current market / material research evidence");
  const marketHeader = sheet.addRow(["Item", "Supplier", "Origin", "Product", "Source Price", "Basis", "VAT", "Normalised Price", "Classification", "Match", "Verified", "Researched", "Source URL"]);
  styleHeaderRow(marketHeader);

  const itemsWithMarketEvidence = data.lineItems.filter((item) => item.marketEvidence && item.marketEvidence.acceptedEvidence.length > 0);
  if (itemsWithMarketEvidence.length === 0) {
    const note = sheet.addRow(["No accepted current-market / material research evidence has been saved for any item in this BOQ yet."]);
    note.font = { italic: true };
    return;
  }

  for (const item of itemsWithMarketEvidence) {
    for (const evidence of item.marketEvidence!.acceptedEvidence) {
      const row = sheet.addRow([
        itemLabel(item),
        evidence.supplierName,
        evidence.sourceOrigin === "international" ? INTERNATIONAL_REFERENCE_LABEL : evidence.sourceOrigin === "south_africa" ? "South Africa" : "Unknown",
        evidence.productDescription,
        evidence.sourcePrice ?? "Price not published — supplier quotation required",
        evidence.pricingBasis,
        evidence.vatStatus,
        evidence.normalisedPrice ?? "",
        MARKET_EVIDENCE_CLASSIFICATION_LABELS[evidence.evidenceClassification],
        evidence.matchType,
        evidence.verified ? "Yes" : "No",
        new Date(evidence.retrievedAt).toLocaleDateString(),
        "",
      ]);
      if (evidence.sourcePrice !== null) row.getCell(5).numFmt = ZAR_FORMAT;
      if (evidence.normalisedPrice !== null) row.getCell(8).numFmt = ZAR_FORMAT;
      if (evidence.sourceOrigin === "international") row.getCell(3).font = { italic: true, color: { argb: "FFB45309" } };
      if (evidence.sourceUrl) {
        row.getCell(13).value = { text: evidence.sourceUrl, hyperlink: evidence.sourceUrl };
      }
    }
  }
}

function addPricingNotesSheet(workbook: ExcelJS.Workbook, data: ExportWorkbookData) {
  const sheet = workbook.addWorksheet("Pricing Notes and Assumptions", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Category", key: "category", width: 28 },
    { header: "Detail", key: "detail", width: 100 },
  ];
  styleHeaderRow(sheet.getRow(1));
  for (const note of data.pricingNotes) {
    const row = sheet.addRow({ category: note.category, detail: note.detail });
    row.alignment = { wrapText: true, vertical: "top" };
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
}

/**
 * Builds the full six-sheet estimator workbook from already-resolved export
 * data (build-export-data.ts) — this module is presentation only, it never
 * derives or recomputes a pricing decision, it just lays out numbers that
 * already exist on ExportWorkbookData.
 */
export async function generateWorkbook(data: ExportWorkbookData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BOQPilot";
  workbook.created = new Date();

  addEstimatorReportSheet(workbook, data);
  addPricedBoqSheet(workbook, data);
  addCostBuildupSheet(workbook, data);
  addReviewSheet(workbook, data);
  addSourcesSheet(workbook, data);
  addPricingNotesSheet(workbook, data);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
