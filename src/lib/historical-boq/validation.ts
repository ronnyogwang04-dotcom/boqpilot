import type { ColumnMap } from "./column-mapper";
import { classifyCategory } from "./categoriser";
import type { ExtractedItem, ParsedRow } from "./types";

export function cellAt(row: ParsedRow, columnIndex: number | undefined): unknown {
  return columnIndex === undefined ? undefined : row[columnIndex];
}

export function cellToText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/**
 * Falls back to the first non-empty cell in a row, in source-column order.
 * Real BOQs frequently type a section/bill heading starting in column A
 * regardless of where the Description column sits — the heading isn't
 * "aligned" to any particular column the way a real line item's cells are.
 */
export function firstNonEmptyCellText(row: ParsedRow): string | null {
  for (const cell of row) {
    const text = cellToText(cell);
    if (text) return text;
  }
  return null;
}

/** Tolerant numeric parsing for BOQ cells: strips currency symbols/thousands separators. */
export function cellToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/[^0-9.,-]/g, "")
    .replace(/,/g, "");
  if (cleaned === "") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds one validated line item from a row already classified as an "item"
 * row. A description is guaranteed present by the caller (section-detector);
 * everything else is optional on the source data but affects `status`:
 * missing/invalid unit or quantity/rate keeps the row (never dropped) but
 * flags it `needs_review` so it surfaces in the library for manual cleanup.
 */
export function buildExtractedItem(params: {
  row: ParsedRow;
  rowNumber: number;
  columnMap: ColumnMap;
  section: string | null;
}): ExtractedItem {
  const { row, rowNumber, columnMap, section } = params;

  const mappedDescription = cellToText(cellAt(row, columnMap.description));
  const description = mappedDescription ?? firstNonEmptyCellText(row) ?? "";
  const itemCode = cellToText(cellAt(row, columnMap.code));
  const unit = cellToText(cellAt(row, columnMap.unit));
  const quantity = cellToNumber(cellAt(row, columnMap.quantity));
  const unitRate = cellToNumber(cellAt(row, columnMap.rate));
  const rawAmount = cellToNumber(cellAt(row, columnMap.amount));
  const amount = rawAmount ?? (quantity !== null && unitRate !== null ? quantity * unitRate : null);

  const validationErrors: string[] = [];
  if (!mappedDescription) validationErrors.push("Description not found in its expected column");
  if (!unit) validationErrors.push("Missing unit");
  if (quantity === null) validationErrors.push("Missing or invalid quantity");
  if (unitRate === null) validationErrors.push("Missing or invalid unit rate");

  return {
    rowNumber,
    rowType: "rate_item",
    section,
    itemCode,
    description,
    unit,
    quantity,
    unitRate,
    amount,
    category: classifyCategory(description, section),
    status: validationErrors.length > 0 ? "needs_review" : "ok",
    validationErrors: validationErrors.length > 0 ? validationErrors : null,
    rawRow: row,
  };
}
