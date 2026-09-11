import { ExcelParser } from "@/lib/historical-boq/parsers/excel-parser";
import { extractItemsFromDocument } from "@/lib/historical-boq/extractor";
import type { ExtractionResult } from "@/lib/historical-boq/types";
import type { BoqLineItemSourceFormat } from "@/types/database.types";
import { extractItemsFromPdfViaAi } from "./pdf-extract";

/**
 * The one seam between "current pricing BOQ" extraction and the Historical
 * BOQ Library's existing, hardened pipeline. Excel is reused byte-for-byte
 * (ExcelParser + extractItemsFromDocument, unchanged); PDF gets its own
 * AI-assisted front end (pdf-extract.ts) since no reliable column grid
 * exists in reflowed PDF text. Both converge on the same ExtractedItem[]
 * shape — no pricing/benchmarking logic is duplicated between formats.
 */
export async function extractCurrentBoqItems(params: {
  buffer: ArrayBuffer;
  sourceFormat: BoqLineItemSourceFormat;
}): Promise<ExtractionResult> {
  if (params.sourceFormat === "excel") {
    const document = await new ExcelParser().parse(params.buffer);
    return extractItemsFromDocument(document);
  }
  return extractItemsFromPdfViaAi(params.buffer);
}
