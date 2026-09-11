import { beforeEach, describe, expect, it, vi } from "vitest";

const readExcelFileMock = vi.fn();
vi.mock("read-excel-file/node", () => ({ default: readExcelFileMock }));

const extractItemsFromPdfViaAiMock = vi.fn();
vi.mock("./pdf-extract", () => ({
  extractItemsFromPdfViaAi: (...args: unknown[]) => extractItemsFromPdfViaAiMock(...args),
}));

beforeEach(() => {
  readExcelFileMock.mockReset();
  extractItemsFromPdfViaAiMock.mockReset();
});

describe("extractCurrentBoqItems", () => {
  it("routes .xlsx buffers through the real, unmodified Excel pipeline (ExcelParser + extractItemsFromDocument)", async () => {
    readExcelFileMock.mockResolvedValueOnce([
      {
        sheet: "Sheet1",
        data: [
          ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
          [1, "Supply and install distribution board", "No", 2, 4500, 9000],
        ],
      },
    ]);
    const { extractCurrentBoqItems } = await import("./extract");

    const result = await extractCurrentBoqItems({ buffer: new ArrayBuffer(0), sourceFormat: "excel" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      rowType: "rate_item",
      description: "Supply and install distribution board",
      unit: "No",
      quantity: 2,
      unitRate: 4500,
    });
    expect(extractItemsFromPdfViaAiMock).not.toHaveBeenCalled();
  });

  it("routes PDF buffers to the AI-assisted extractor, not the Excel pipeline", async () => {
    extractItemsFromPdfViaAiMock.mockResolvedValueOnce({
      items: [],
      summary: { rowsDetected: 0, rowsExtracted: 0, rowsNeedsReview: 0, rowsError: 0 },
    });
    const { extractCurrentBoqItems } = await import("./extract");

    await extractCurrentBoqItems({ buffer: new ArrayBuffer(0), sourceFormat: "pdf" });

    expect(extractItemsFromPdfViaAiMock).toHaveBeenCalledTimes(1);
    expect(readExcelFileMock).not.toHaveBeenCalled();
  });
});
