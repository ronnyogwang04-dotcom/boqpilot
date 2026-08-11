import type { BoqParser, ParsedDocument } from "../types";
import { UnsupportedFormatError } from "../types";

/**
 * Adapter placeholder. Wired into the registry so the upload form can already
 * offer Word as a source type once this is implemented — no changes needed
 * anywhere else in the pipeline.
 */
export class WordParser implements BoqParser {
  async parse(): Promise<ParsedDocument> {
    throw new UnsupportedFormatError("Word historical BOQ parsing is not implemented yet.");
  }
}
