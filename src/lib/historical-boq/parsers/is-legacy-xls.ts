/**
 * Standalone, dependency-free check so client components (like the upload
 * form) can detect a legacy .xls pick without pulling registry.ts's other
 * exports — and therefore ExcelParser/read-excel-file, which needs Node
 * built-ins (fs/stream/worker_threads) — into the browser bundle.
 *
 * read-excel-file (the only Excel parser wired up for historical BOQ
 * ingestion) deliberately and permanently rejects legacy OLE2 binary .xls
 * files — it only supports OOXML .xlsx. Detected separately from
 * resolveSourceType so callers can give an honest, specific rejection
 * message instead of the generic "unsupported file type" one.
 */
export function isLegacyXlsFile(filename: string, mimeType: string): boolean {
  return filename.toLowerCase().endsWith(".xls") || mimeType === "application/vnd.ms-excel";
}
