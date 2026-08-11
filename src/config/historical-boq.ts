// Single source of truth for Historical BOQ Library upload/processing limits.
// Processing runs synchronously inside the upload Server Action (no queue
// worker exists in this codebase yet), so these caps bound worst-case
// request time rather than being arbitrary.

export const historicalLibraryConfig = {
  maxUploadSizeMb: 15,
  maxRowsPerFile: 50_000,

  // Extensions/mime types accepted by the upload form today. PDF and Word
  // are modeled in the parser registry but not yet implemented.
  acceptedExtensions: [".xlsx", ".xls"],
  acceptedMimeTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],

  // Rows inserted per batch when writing extracted items to Postgres.
  insertBatchSize: 500,
};
