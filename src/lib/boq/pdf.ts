import { PDFDocument } from "pdf-lib";

/**
 * Reads only the page count from a PDF's structure — never renders or
 * extracts content. The caller must not persist `buffer` anywhere; it's read
 * once here and then discarded.
 */
export async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false });
    return doc.getPageCount();
  } catch {
    throw new Error("Could not read this file as a PDF. Please upload a valid, unencrypted PDF.");
  }
}
