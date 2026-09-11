import { z } from "zod";
import { extractStructuredRows } from "../openai-chat-client";
import { marketResearchConfig } from "@/config/market-research";
import type { MarketSearchSpecification } from "./types";

const marketSearchSpecSchema = z.object({
  activity: z.string().nullable().describe("What the BOQ item asks for, e.g. 'supply and install', 'supply only', 'install only'."),
  primaryMaterial: z.string().describe("The core material or product being priced, stripped of quantity/BOQ boilerplate, e.g. 'uPVC soil pipe'."),
  specification: z.string().nullable().describe("Class/grade/pressure rating/performance spec explicitly stated, e.g. 'Class 34'. Null if none stated."),
  dimensions: z.string().nullable().describe("Size/diameter/capacity explicitly stated, e.g. '110mm diameter'. Null if none stated."),
  application: z.string().nullable().describe("What the item is used for, e.g. 'soil/drainage', 'structural', 'roofing'."),
  ancillaryMaterials: z.array(z.string()).describe("Secondary materials implied or named alongside the primary one, e.g. ['fittings', 'couplers']. Empty array if none."),
  category: z.string().nullable().describe("Broad trade/category, e.g. 'Plumbing & Drainage', 'Electrical', 'Structural steel'."),
  brand: z.string().nullable().describe("Manufacturer/brand/model explicitly named in the BOQ text. Null if not brand-specified."),
  standard: z.string().nullable().describe("SANS/SABS or other named standard explicitly referenced. Null if none."),
});

const SYSTEM_PROMPT = `You convert a construction Bill of Quantities (BOQ) line item into a structured product/material search specification.

Rules:
- Extract only what is reasonably necessary to identify the material or product being priced.
- Never invent a specification, dimension, brand, or standard that is not stated or clearly implied by the text.
- If something is not stated, return null (or an empty array for ancillaryMaterials) rather than guessing.
- Do not include any client name, project name, tender number, contractor name, or rate/price information — there is none in scope here, but never fabricate it either.`;

/**
 * Turns a raw BOQ description into a search specification (spec §4) using
 * the existing structured-output extraction helper (openai-chat-client.ts —
 * the same one PDF extraction uses), never the raw description itself. This
 * is a separate, cheap chat-completions call from the web-search research
 * call that follows it.
 */
export async function buildMarketSearchSpecification(item: {
  description: string;
  unit: string | null;
  category: string | null;
  province: string | null;
  town: string | null;
}): Promise<MarketSearchSpecification> {
  const parsed = await extractStructuredRows({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `BOQ item description: "${item.description}"\nBOQ unit: ${item.unit ?? "(not stated)"}\nKnown category (if any): ${item.category ?? "(unknown)"}`,
    schema: marketSearchSpecSchema,
    schemaName: "market_search_specification",
  });

  return {
    ...parsed,
    boqUnit: item.unit,
    country: marketResearchConfig.country,
    province: item.province,
    town: item.town,
  };
}
