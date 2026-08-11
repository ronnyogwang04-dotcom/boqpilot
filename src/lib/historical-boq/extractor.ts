import { detectHeaderRow } from "./column-mapper";
import { classifyRow } from "./section-detector";
import { buildExtractedItem, cellAt, cellToText, firstNonEmptyCellText } from "./validation";
import { HEADING_ROW_TYPES } from "./row-type";
import type { ExtractedItem, ExtractionResult, ParsedDocument } from "./types";

/**
 * Orchestrates the pipeline over a whole parsed document: for each sheet,
 * find its header row (skip the sheet entirely if none is found — e.g. a
 * cover/notes sheet), then walk the remaining rows, tracking the current
 * section and building one ExtractedItem per row. Rows never silently
 * vanish: blank rows are skipped, everything else — genuine rate items and
 * non-rate-bearing content alike (headings, subtotals, notes, contractual
 * text) — becomes a stored ExtractedItem, tagged with its row_type. Only
 * rate_item rows run through buildExtractedItem's full validation; a
 * heading/note/contractual row has nothing to validate, so it's always
 * `status: "ok"` with its structured fields left null (its original text is
 * still fully recoverable from rawRow for audit).
 */
export function extractItemsFromDocument(document: ParsedDocument): ExtractionResult {
  const items: ExtractedItem[] = [];
  let rowsDetected = 0;
  let rowsError = 0;
  let globalRowNumber = 0;

  for (const sheet of document.sheets) {
    const headerResult = detectHeaderRow(sheet.rows);
    if (!headerResult) continue;

    const { headerRowIndex, columnMap } = headerResult;
    let currentSection: string | null = sheet.name;

    for (let rowIndex = headerRowIndex + 1; rowIndex < sheet.rows.length; rowIndex++) {
      const row = sheet.rows[rowIndex];
      globalRowNumber++;

      const rowType = classifyRow(row, columnMap);
      if (rowType === "blank") continue;

      if (rowType !== "rate_item") {
        const text = cellToText(cellAt(row, columnMap.description)) ?? firstNonEmptyCellText(row) ?? "(unreadable row)";
        if (HEADING_ROW_TYPES.has(rowType)) currentSection = text;

        items.push({
          rowNumber: globalRowNumber,
          rowType,
          section: currentSection,
          itemCode: null,
          description: text,
          unit: null,
          quantity: null,
          unitRate: null,
          amount: null,
          category: null,
          status: "ok",
          validationErrors: null,
          rawRow: row,
        });
        continue;
      }

      rowsDetected++;

      try {
        items.push(
          buildExtractedItem({ row, rowNumber: globalRowNumber, columnMap, section: currentSection }),
        );
      } catch (error) {
        rowsError++;
        items.push({
          rowNumber: globalRowNumber,
          rowType: "rate_item",
          section: currentSection,
          itemCode: null,
          description: cellToText(cellAt(row, columnMap.description)) ?? firstNonEmptyCellText(row) ?? "(unreadable row)",
          unit: null,
          quantity: null,
          unitRate: null,
          amount: null,
          category: null,
          status: "error",
          validationErrors: [error instanceof Error ? error.message : "Unexpected error extracting row"],
          rawRow: row,
        });
      }
    }
  }

  return {
    items,
    summary: {
      rowsDetected,
      rowsExtracted: items.length,
      rowsNeedsReview: items.filter((item) => item.status === "needs_review").length,
      rowsError,
    },
  };
}
