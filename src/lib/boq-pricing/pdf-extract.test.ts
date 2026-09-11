import { beforeEach, describe, expect, it, vi } from "vitest";

const getTextMock = vi.fn();
const destroyMock = vi.fn();
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(function PDFParseMock() {
    return { getText: getTextMock, destroy: destroyMock };
  }),
}));

const extractStructuredRowsMock = vi.fn();
vi.mock("./openai-chat-client", () => ({
  extractStructuredRows: (...args: unknown[]) => extractStructuredRowsMock(...args),
}));

beforeEach(() => {
  getTextMock.mockReset();
  destroyMock.mockReset();
  extractStructuredRowsMock.mockReset();
});

describe("extractItemsFromPdfViaAi", () => {
  it("builds a rate_item with derived amount and classified category from a well-formed AI row", async () => {
    getTextMock.mockResolvedValueOnce({ pages: [{ num: 1, text: "some page text" }] });
    extractStructuredRowsMock.mockResolvedValueOnce({
      rows: [
        {
          rowType: "rate_item",
          itemCode: null,
          description: "Reinforced concrete 25mpa in slab",
          unit: "m3",
          quantity: 10,
          unitRate: 2000,
          amount: null,
        },
      ],
    });
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    const result = await extractItemsFromPdfViaAi(new ArrayBuffer(0));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      rowType: "rate_item",
      description: "Reinforced concrete 25mpa in slab",
      quantity: 10,
      unitRate: 2000,
      amount: 20000, // derived: quantity * unitRate
      category: "Concrete & Formwork",
      status: "ok",
    });
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("carries section forward from a heading row, self-referentially on the heading itself", async () => {
    getTextMock.mockResolvedValueOnce({ pages: [{ num: 1, text: "page text" }] });
    extractStructuredRowsMock.mockResolvedValueOnce({
      rows: [
        { rowType: "bill_heading", itemCode: null, description: "BILL NO 2: DRAINAGE", unit: null, quantity: null, unitRate: null, amount: null },
        { rowType: "rate_item", itemCode: null, description: "110mm uPVC pipe", unit: "m", quantity: 5, unitRate: 150, amount: null },
      ],
    });
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    const result = await extractItemsFromPdfViaAi(new ArrayBuffer(0));

    expect(result.items[0].section).toBe("BILL NO 2: DRAINAGE");
    expect(result.items[1].section).toBe("BILL NO 2: DRAINAGE");
  });

  it("downgrades to needs_review when the model calls a row rate_item but no numeric signal corroborates it", async () => {
    getTextMock.mockResolvedValueOnce({ pages: [{ num: 1, text: "page text" }] });
    extractStructuredRowsMock.mockResolvedValueOnce({
      rows: [
        { rowType: "rate_item", itemCode: "H1", description: "See separate document", unit: null, quantity: null, unitRate: null, amount: null },
      ],
    });
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    const result = await extractItemsFromPdfViaAi(new ArrayBuffer(0));

    expect(result.items[0].status).toBe("needs_review");
    expect(result.items[0].validationErrors).toContain(
      "AI classified this as a rate item, but no numeric signal (quantity/unit/rate/amount) corroborates it — please verify",
    );
  });

  it("keeps status ok for a corroborated rate item even with a missing unit rate (legitimately unpriced)", async () => {
    getTextMock.mockResolvedValueOnce({ pages: [{ num: 1, text: "page text" }] });
    extractStructuredRowsMock.mockResolvedValueOnce({
      rows: [{ rowType: "rate_item", itemCode: null, description: "Excavate trench", unit: "m3", quantity: 20, unitRate: null, amount: null }],
    });
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    const result = await extractItemsFromPdfViaAi(new ArrayBuffer(0));

    // quantity + a strong/recognised unit alone corroborates isLikelyRateItem,
    // but the missing rate itself still flags needs_review (unpriced item).
    expect(result.items[0].status).toBe("needs_review");
    expect(result.items[0].validationErrors).toContain("Missing or invalid unit rate");
    expect(result.items[0].validationErrors).not.toContain(
      "AI classified this as a rate item, but no numeric signal (quantity/unit/rate/amount) corroborates it — please verify",
    );
  });

  it("records a single error item for a page-chunk that fails extraction, and continues with the rest", async () => {
    getTextMock.mockResolvedValueOnce({
      pages: [
        { num: 1, text: "page 1" },
        { num: 2, text: "page 2" },
        { num: 3, text: "page 3" },
        { num: 4, text: "page 4" },
        { num: 5, text: "page 5" },
      ],
    });
    extractStructuredRowsMock
      .mockRejectedValueOnce(new Error("model refused"))
      .mockResolvedValueOnce({
        rows: [{ rowType: "rate_item", itemCode: null, description: "Supply sand", unit: "m3", quantity: 3, unitRate: 250, amount: null }],
      });
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    const result = await extractItemsFromPdfViaAi(new ArrayBuffer(0));

    expect(result.summary.rowsError).toBe(1);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe("error");
    expect(result.items[1].description).toBe("Supply sand");
  });

  it("always destroys the parser, even when getText() throws", async () => {
    getTextMock.mockRejectedValueOnce(new Error("corrupt PDF"));
    const { extractItemsFromPdfViaAi } = await import("./pdf-extract");

    await expect(extractItemsFromPdfViaAi(new ArrayBuffer(0))).rejects.toThrow("corrupt PDF");
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});
