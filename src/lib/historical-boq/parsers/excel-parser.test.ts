import { describe, expect, it, vi } from "vitest";

const readExcelFileMock = vi.fn();
vi.mock("read-excel-file/node", () => ({ default: readExcelFileMock }));

describe("ExcelParser", () => {
  it("replaces a bare TypeError from read-excel-file's internals with a friendly, actionable message", async () => {
    readExcelFileMock.mockRejectedValueOnce(new TypeError("Cannot read properties of undefined (reading 'rows')"));
    const { ExcelParser } = await import("./excel-parser");
    const parser = new ExcelParser();

    await expect(parser.parse(new ArrayBuffer(0))).rejects.toThrow(/couldn't be parsed/i);
  });

  it("lets a library-defined error (not a bare TypeError) pass through unchanged", async () => {
    class InvalidSpreadsheetError extends Error {}
    readExcelFileMock.mockRejectedValueOnce(new InvalidSpreadsheetError("Invalid spreadsheet"));
    const { ExcelParser } = await import("./excel-parser");
    const parser = new ExcelParser();

    await expect(parser.parse(new ArrayBuffer(0))).rejects.toThrow("Invalid spreadsheet");
  });

  it("returns parsed sheets on success", async () => {
    readExcelFileMock.mockResolvedValueOnce([{ sheet: "Sheet1", data: [["a", "b"]] }]);
    const { ExcelParser } = await import("./excel-parser");
    const parser = new ExcelParser();

    const document = await parser.parse(new ArrayBuffer(0));
    expect(document.sheets).toEqual([{ name: "Sheet1", rows: [["a", "b"]] }]);
  });
});
