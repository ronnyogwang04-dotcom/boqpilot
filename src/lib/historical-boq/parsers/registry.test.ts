import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import readExcelFile from "read-excel-file/node";
import { isLegacyXlsFile, resolveSourceType } from "./registry";

const legacyXlsBuffer = readFileSync(join(__dirname, "__fixtures__/legacy-workbook.xls"));

describe("isLegacyXlsFile", () => {
  it("flags a .xls filename regardless of mime type", () => {
    expect(isLegacyXlsFile("historical-boq.xls", "")).toBe(true);
  });

  it("flags the legacy Excel 97-2003 mime type regardless of extension", () => {
    expect(isLegacyXlsFile("historical-boq", "application/vnd.ms-excel")).toBe(true);
  });

  it("does not flag a real .xlsx file", () => {
    expect(
      isLegacyXlsFile(
        "historical-boq.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(false);
  });
});

describe("resolveSourceType", () => {
  it("no longer classifies .xls as an excel source type", () => {
    expect(resolveSourceType("historical-boq.xls", "application/vnd.ms-excel")).toBeNull();
  });

  it("still classifies .xlsx as excel", () => {
    expect(
      resolveSourceType(
        "historical-boq.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("excel");
  });
});

describe("read-excel-file legacy .xls behaviour (regression guard)", () => {
  it("permanently rejects a genuine legacy .xls file — documents why the app rejects it early instead of parsing it", async () => {
    await expect(readExcelFile(legacyXlsBuffer)).rejects.toMatchObject({
      code: "XLS_FILE_NOT_SUPPORTED",
    });
  });
});
