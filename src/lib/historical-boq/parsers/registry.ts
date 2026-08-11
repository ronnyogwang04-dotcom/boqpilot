import type { HistoricalBoqSourceType } from "@/types/database.types";
import type { BoqParser } from "../types";
import { ExcelParser } from "./excel-parser";
import { PdfParser } from "./pdf-parser";
import { WordParser } from "./word-parser";

/**
 * The adapter registry: the only place that knows which parser handles which
 * document type. Adding a new document type is "implement BoqParser, add one
 * entry here" — the rest of the pipeline (column-mapper, section-detector,
 * categoriser, validation, extractor, process-historical-boq) never branches
 * on file format.
 */
const parsersBySourceType: Record<HistoricalBoqSourceType, () => BoqParser> = {
  excel: () => new ExcelParser(),
  pdf: () => new PdfParser(),
  word: () => new WordParser(),
};

const extensionToSourceType: Record<string, HistoricalBoqSourceType> = {
  ".xlsx": "excel",
  ".xls": "excel",
  ".pdf": "pdf",
  ".doc": "word",
  ".docx": "word",
};

const mimeTypeToSourceType: Record<string, HistoricalBoqSourceType> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel": "excel",
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
};

export function resolveSourceType(filename: string, mimeType: string): HistoricalBoqSourceType | null {
  if (mimeTypeToSourceType[mimeType]) return mimeTypeToSourceType[mimeType];

  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return extensionToSourceType[extension] ?? null;
}

export function getParserForSourceType(sourceType: HistoricalBoqSourceType): BoqParser {
  return parsersBySourceType[sourceType]();
}
