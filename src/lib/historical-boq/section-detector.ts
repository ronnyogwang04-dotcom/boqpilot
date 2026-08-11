import type { ColumnMap } from "./column-mapper";
import type { ParsedRow } from "./types";
import { cellAt, cellToText, cellToNumber, firstNonEmptyCellText } from "./validation";
import { classifyNonRateRowType, isDefinitiveNonRateUnit, isLikelyRateItem, matchDefinitiveRowType, type RowType } from "./row-type";
import { isKnownUnit, normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";

export type RowClassification = RowType | "blank";

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

/**
 * Classifies a row as blank, a genuine rate-bearing item, or one of the
 * non-rate-bearing row types (heading, subtotal, note, contractual text,
 * ...) — see row-type.ts for the rationale. Whether the row's text sits in
 * the mapped Description column doesn't factor into the non-item text
 * classification: a real heading or clause paragraph is very often typed
 * starting in column A regardless of where Description happens to be,
 * since it's a label spanning the row rather than data aligned to a column.
 */
export function classifyRow(row: ParsedRow, columnMap: ColumnMap): RowClassification {
  const isRowBlank = row.every(isEmptyCell);
  if (isRowBlank) return "blank";

  const text = cellToText(cellAt(row, columnMap.description)) ?? firstNonEmptyCellText(row) ?? "";
  const unitText = cellToText(cellAt(row, columnMap.unit));

  // Definitive signals win unconditionally — no real BOQ line item's own
  // description is literally "BILL NO 3", "Sub Total", or "NOTE: ...", and
  // no real unit is literally "Page" or "VAT" (bills-summary/index or tax
  // markers), regardless of what stray numbers sit in nearby cells (see
  // row-type.ts).
  const definitive = matchDefinitiveRowType(text);
  if (definitive) return definitive;
  if (isDefinitiveNonRateUnit(unitText)) return "subtotal_total";

  const quantity = cellToNumber(cellAt(row, columnMap.quantity));
  const rate = cellToNumber(cellAt(row, columnMap.rate));
  const amount = cellToNumber(cellAt(row, columnMap.amount));
  const normalisedUnit = unitText !== null ? normaliseUnit(unitText) : null;
  const recognisedUnit = normalisedUnit !== null && isKnownUnit(normalisedUnit) ? normalisedUnit : null;

  const isRateItem = isLikelyRateItem({ quantity, unit: recognisedUnit, rate, amount });
  if (isRateItem) return "rate_item";

  return classifyNonRateRowType(text);
}
