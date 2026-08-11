import type { ParsedRow } from "./types";

export type ColumnRole = "code" | "description" | "unit" | "quantity" | "rate" | "amount";

export type ColumnMap = Partial<Record<ColumnRole, number>>;

export type HeaderDetectionResult = {
  headerRowIndex: number;
  columnMap: ColumnMap;
};

// Order matters where aliases could otherwise collide (e.g. a "unit rate"
// header must resolve to `rate`, not `unit`) — matching is by exact
// normalised text, so "unit" and "unit rate" never both match the same cell.
const HEADER_ALIASES: Record<ColumnRole, string[]> = {
  code: ["item", "item no", "itemno", "item ref", "ref", "reference", "code", "bill item", "no"],
  description: ["description", "particulars", "item description", "desc"],
  unit: ["unit", "uom", "u m", "units"],
  quantity: ["qty", "quantity", "qnty"],
  rate: ["rate", "unit rate", "unit price", "price", "rate r"],
  amount: ["amount", "total", "extended", "extended price", "value", "sum"],
};

function normaliseHeaderText(cell: unknown): string {
  return String(cell ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchColumnRole(headerText: string): ColumnRole | null {
  if (!headerText) return null;

  for (const [role, aliases] of Object.entries(HEADER_ALIASES) as [ColumnRole, string[]][]) {
    if (aliases.includes(headerText)) return role;
  }
  return null;
}

/**
 * Falls back to inferring the Description column when every other role
 * (code, unit, quantity, rate, amount) is confidently identified but
 * Description specifically isn't — e.g. a corrupted or garbled header cell
 * in that one position. Confirmed on a real historical BOQ whose header row
 * was ["SECTION", "BILL", "PAGE NO", "ITEM NO", "][td[rt]hy']", "UNIT",
 * "QUANTITY", "RATE", "AMOUNT"] — every alias matched except the garbled
 * cell, which sat exactly where Description belongs.
 *
 * Only attempts this when the Item/Code column is matched (a reliable left
 * boundary — the code column sits immediately before Description in
 * virtually every real BOQ) and there is EXACTLY ONE unclaimed column
 * between it and the nearest matched measure column. Any other shape (no
 * code column, zero or multiple candidate gap columns) is genuinely
 * ambiguous and is left alone rather than guessed at.
 */
function inferDescriptionColumn(columnMap: ColumnMap): number | null {
  if (columnMap.description !== undefined) return null;
  if (columnMap.code === undefined) return null;

  const measureIndices = [columnMap.unit, columnMap.quantity, columnMap.rate, columnMap.amount].filter(
    (index): index is number => index !== undefined,
  );
  if (measureIndices.length === 0) return null;

  const rightBoundary = Math.min(...measureIndices);
  const claimed = new Set(Object.values(columnMap));

  const candidates: number[] = [];
  for (let index = columnMap.code + 1; index < rightBoundary; index++) {
    if (!claimed.has(index)) candidates.push(index);
  }

  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Scans the first `searchLimit` rows of a sheet for a header row: one that
 * maps a description column plus at least one of unit/quantity/rate. Historical
 * BOQs vary widely in column naming, so this is alias-based rather than
 * positional.
 */
export function detectHeaderRow(rows: ParsedRow[], searchLimit = 20): HeaderDetectionResult | null {
  const limit = Math.min(rows.length, searchLimit);

  for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
    const row = rows[rowIndex];
    const columnMap: ColumnMap = {};

    row.forEach((cell, columnIndex) => {
      const role = matchColumnRole(normaliseHeaderText(cell));
      if (role && columnMap[role] === undefined) {
        columnMap[role] = columnIndex;
      }
    });

    const hasAtLeastOneMeasure =
      columnMap.unit !== undefined || columnMap.quantity !== undefined || columnMap.rate !== undefined;

    if (columnMap.description !== undefined && hasAtLeastOneMeasure) {
      return { headerRowIndex: rowIndex, columnMap };
    }

    const inferredDescription = inferDescriptionColumn(columnMap);
    if (inferredDescription !== null && hasAtLeastOneMeasure) {
      return { headerRowIndex: rowIndex, columnMap: { ...columnMap, description: inferredDescription } };
    }
  }

  return null;
}
