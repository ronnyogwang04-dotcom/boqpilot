import type { BoqParser, ParsedDocument } from "../types";
import { UnsupportedFormatError } from "../types";

/**
 * Adapter placeholder. Wired into the registry so the upload form can already
 * offer PDF as a source type once this is implemented — no changes needed
 * anywhere else in the pipeline.
 */
export class PdfParser implements BoqParser {
  async parse(): Promise<ParsedDocument> {
    throw new UnsupportedFormatError("PDF historical BOQ parsing is not implemented yet.");
  }
}
