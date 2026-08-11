import readExcelFile from "read-excel-file/node";
import type { BoqParser, ParsedDocument } from "../types";

/** Reads every sheet of an .xlsx/.xls file into raw rows of cell values. */
export class ExcelParser implements BoqParser {
  async parse(buffer: ArrayBuffer): Promise<ParsedDocument> {
    let sheets: Awaited<ReturnType<typeof readExcelFile>>;
    try {
      sheets = await readExcelFile(Buffer.from(buffer));
    } catch (error) {
      // read-excel-file (confirmed on v9.3.9) can throw a bare TypeError
      // from deep inside its internal streaming XML state machine on
      // certain real files — reproduced with a single very large, very wide
      // sheet (dimension spanning all 16,384 columns) — rather than one of
      // its own typed error classes (InvalidSpreadsheetError,
      // SheetNotFoundError, etc.). Surfacing that raw internal message
      // ("Cannot read properties of undefined (reading 'rows')") to a user
      // is meaningless, so any bare TypeError escaping the library is
      // treated as this same class of internal parsing failure and
      // replaced with something actionable. The library's own typed errors
      // pass through unchanged.
      if (error instanceof TypeError) {
        throw new Error(
          "This Excel file couldn't be parsed — it may have an unusually large or complex sheet. Try removing empty sheets or excess formatting and re-saving as a fresh .xlsx file, then upload again.",
        );
      }
      throw error;
    }

    return {
      sheets: sheets.map((sheet) => ({
        name: sheet.sheet,
        // read-excel-file types a Date cell as `typeof Date` (a library typing
        // quirk) even though the runtime value is always a Date instance.
        rows: sheet.data as unknown as ParsedDocument["sheets"][number]["rows"],
      })),
    };
  }
}
