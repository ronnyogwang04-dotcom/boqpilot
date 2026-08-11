import type { HistoricalBoqItemStatus } from "@/types/database.types";
import type { RowType } from "./row-type";

// A single spreadsheet/table cell as produced by a parser adapter, before any
// column mapping or validation happens.
export type ParsedCell = string | number | boolean | Date | null;

export type ParsedRow = ParsedCell[];

export type ParsedSheet = {
  name: string;
  rows: ParsedRow[];
};

export type ParsedDocument = {
  sheets: ParsedSheet[];
};

/**
 * The adapter-pattern seam: every document format (Excel, PDF, Word, ...)
 * implements this interface. The extraction pipeline only ever depends on
 * this interface, never on a specific format's parsing library, so adding a
 * new format is a new file in parsers/ plus a registry entry — no changes to
 * column-mapper.ts, section-detector.ts, categoriser.ts, validation.ts, or
 * extractor.ts.
 */
export interface BoqParser {
  parse(buffer: ArrayBuffer): Promise<ParsedDocument>;
}

export class UnsupportedFormatError extends Error {}

export type ExtractedItem = {
  rowNumber: number;
  rowType: RowType;
  section: string | null;
  itemCode: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  unitRate: number | null;
  amount: number | null;
  category: string | null;
  status: HistoricalBoqItemStatus;
  validationErrors: string[] | null;
  rawRow: ParsedCell[];
};

export type ExtractionSummary = {
  rowsDetected: number;
  rowsExtracted: number;
  rowsNeedsReview: number;
  rowsError: number;
};

export type ExtractionResult = {
  items: ExtractedItem[];
  summary: ExtractionSummary;
};
