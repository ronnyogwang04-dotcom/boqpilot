import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { boqPricingConfig } from "@/config/boq-pricing";
import { chunkArray } from "@/lib/embeddings/chunk";
import { classifyCategory } from "@/lib/historical-boq/categoriser";
import { HEADING_ROW_TYPES, isLikelyRateItem } from "@/lib/historical-boq/row-type";
import { isKnownUnit, normaliseUnit } from "@/lib/construction-intelligence/normalise-unit";
import type { ExtractedItem, ExtractionResult } from "@/lib/historical-boq/types";
import { extractStructuredRows } from "./openai-chat-client";

const ROW_TYPES = [
  "rate_item",
  "bill_heading",
  "section_heading",
  "subtotal_total",
  "preliminary_general",
  "note_specification",
  "contractual_text",
  "general_text",
] as const;

const PdfRowSchema = z.object({
  rowType: z.enum(ROW_TYPES),
  itemCode: z.string().nullable(),
  description: z.string(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  unitRate: z.number().nullable(),
  amount: z.number().nullable(),
});
type PdfRow = z.infer<typeof PdfRowSchema>;

const PdfPageGroupSchema = z.object({ rows: z.array(PdfRowSchema) });

const SYSTEM_PROMPT = `You extract structured line items from pages of a construction Bill of Quantities (BOQ) PDF.

Emit exactly one row per line in the source text — never skip a row, including headings, subtotals, notes, and contractual text. Never invent a value: if a field isn't present in the text, use null for it, don't guess.

Classify every row's rowType from this fixed vocabulary:
- "rate_item": a genuine priceable line item — has a description of measurable work/material, and normally at least one of a unit, quantity, rate, or amount.
- "bill_heading": a heading like "BILL NO 3: DRAINAGE".
- "section_heading": a heading like "SECTION 2: EARTHWORKS" or a trade/section title.
- "subtotal_total": subtotal/total/carried-forward/brought-forward/VAT rows.
- "preliminary_general": preliminaries or general-conditions clauses (JBCC-style boilerplate).
- "note_specification": a "NOTE:"/"N.B."/"Specification:" row.
- "contractual_text": contract clauses, definitions, tender conditions.
- "general_text": anything else that isn't a priceable item.

Preserve the original wording of description exactly as written (don't paraphrase or correct it). unit should be the unit exactly as abbreviated in the source (e.g. "m2", "No", "sum") — do not normalise it yourself. quantity/unitRate/amount are numeric only (strip currency symbols and thousands separators yourself, but do not invent a value that isn't printed).`;

function buildUserPrompt(pages: { num: number; text: string }[], currentSection: string | null): string {
  const pageBlocks = pages.map((p) => `--- Page ${p.num} ---\n${p.text}`).join("\n\n");
  const sectionHint =
    currentSection !== null
      ? `The current section/bill heading carried over from the previous page is: "${currentSection}". Use this as context only — you don't need to repeat it in every row.`
      : "No section heading has been seen yet.";
  return `${sectionHint}\n\n${pageBlocks}`;
}

function buildItemFromAiRow(row: PdfRow, rowNumber: number, currentSection: string | null): ExtractedItem {
  const rawRow = [JSON.stringify(row)];

  if (row.rowType !== "rate_item") {
    return {
      rowNumber,
      rowType: row.rowType,
      section: currentSection,
      itemCode: null,
      description: row.description,
      unit: null,
      quantity: null,
      unitRate: null,
      amount: null,
      category: null,
      status: "ok",
      validationErrors: null,
      rawRow,
    };
  }

  const amount = row.amount ?? (row.quantity !== null && row.unitRate !== null ? row.quantity * row.unitRate : null);
  const normalisedUnit = row.unit !== null ? normaliseUnit(row.unit) : null;
  const recognisedUnit = normalisedUnit !== null && isKnownUnit(normalisedUnit) ? normalisedUnit : null;
  // Cross-check the model's own "this is a rate item" judgement against the
  // same deterministic numeric-signal heuristic the Excel path relies on
  // (section-detector.ts) — the model classifies far more reliably than
  // column-position heuristics on reflowed PDF text, but a row it calls a
  // rate item with literally no corroborating number is flagged for human
  // review rather than trusted blindly.
  const corroborated = isLikelyRateItem({ quantity: row.quantity, unit: recognisedUnit, rate: row.unitRate, amount });

  const validationErrors: string[] = [];
  if (!row.unit) validationErrors.push("Missing unit");
  if (row.quantity === null) validationErrors.push("Missing or invalid quantity");
  if (row.unitRate === null) validationErrors.push("Missing or invalid unit rate");
  if (!corroborated) {
    validationErrors.push("AI classified this as a rate item, but no numeric signal (quantity/unit/rate/amount) corroborates it — please verify");
  }

  return {
    rowNumber,
    rowType: "rate_item",
    section: currentSection,
    itemCode: row.itemCode,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitRate: row.unitRate,
    amount,
    category: classifyCategory(row.description, currentSection),
    status: validationErrors.length > 0 ? "needs_review" : "ok",
    validationErrors: validationErrors.length > 0 ? validationErrors : null,
    rawRow,
  };
}

/**
 * PDF-specific front end: turns raw PDF bytes into the SAME ExtractedItem[]
 * shape extractItemsFromDocument() produces for Excel — everything
 * downstream (insertion, normalisation, benchmarking, UI) is format-
 * agnostic past this function's return value. Unlike the Excel path, there
 * is no reliable column grid to detect in reflowed PDF text, so an OpenAI
 * structured-output call does the semantic work column-position heuristics
 * do for spreadsheets. A chunk (page-group) that fails extraction after
 * retries doesn't abort the whole document — it's recorded as a single
 * error item and the run continues, same resilience posture as
 * runEmbeddingBackfill's per-chunk handling (src/lib/embeddings/backfill.ts).
 */
export async function extractItemsFromPdfViaAi(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: Buffer.from(buffer) });
  let pages: { num: number; text: string }[];
  try {
    const result = await parser.getText();
    pages = result.pages;
  } finally {
    await parser.destroy();
  }

  const pageChunks = chunkArray(pages, boqPricingConfig.pdfPagesPerExtractionChunk);
  const items: ExtractedItem[] = [];
  let globalRowNumber = 0;
  let currentSection: string | null = null;
  let rowsError = 0;

  for (const pageChunk of pageChunks) {
    try {
      const parsed: z.infer<typeof PdfPageGroupSchema> = await extractStructuredRows({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(pageChunk, currentSection),
        schema: PdfPageGroupSchema,
        schemaName: "boq_rows",
      });
      const { rows } = parsed;

      for (const row of rows) {
        globalRowNumber++;
        if (HEADING_ROW_TYPES.has(row.rowType)) currentSection = row.description;
        items.push(buildItemFromAiRow(row, globalRowNumber, currentSection));
      }
    } catch (error) {
      globalRowNumber++;
      rowsError++;
      const firstPage = pageChunk[0]?.num;
      const lastPage = pageChunk[pageChunk.length - 1]?.num;
      items.push({
        rowNumber: globalRowNumber,
        rowType: "general_text",
        section: currentSection,
        itemCode: null,
        description: `(AI extraction failed for page ${firstPage}-${lastPage})`,
        unit: null,
        quantity: null,
        unitRate: null,
        amount: null,
        category: null,
        status: "error",
        validationErrors: [error instanceof Error ? error.message : "AI extraction failed"],
        rawRow: [],
      });
    }
  }

  return {
    items,
    summary: {
      rowsDetected: items.filter((item) => item.rowType === "rate_item").length,
      rowsExtracted: items.length,
      rowsNeedsReview: items.filter((item) => item.status === "needs_review").length,
      rowsError,
    },
  };
}
