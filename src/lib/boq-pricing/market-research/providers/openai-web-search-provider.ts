import OpenAI from "openai";
import { z } from "zod";
import { marketResearchConfig } from "@/config/market-research";
import { extractStructuredRows } from "../../openai-chat-client";
import type { MarketEvidenceItem, MarketResearchProvider, MarketResearchProviderResult, MarketSearchSpecification } from "../types";

/**
 * Same lazy-key convention as embeddings/openai-client.ts and
 * boq-pricing/openai-chat-client.ts: read process.env.OPENAI_API_KEY only
 * when actually called, never at module load.
 */
export function isOpenAiWebSearchConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — cannot run market research web search.");
  }
  cachedClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

function describeSpec(spec: MarketSearchSpecification): string {
  const lines = [
    `Primary material/product: ${spec.primaryMaterial}`,
    spec.activity ? `Activity: ${spec.activity}` : null,
    spec.specification ? `Specification/class: ${spec.specification}` : null,
    spec.dimensions ? `Dimensions/size: ${spec.dimensions}` : null,
    spec.application ? `Application: ${spec.application}` : null,
    spec.ancillaryMaterials.length > 0 ? `Ancillary materials: ${spec.ancillaryMaterials.join(", ")}` : null,
    spec.category ? `Category: ${spec.category}` : null,
    spec.brand ? `Brand/manufacturer specified: ${spec.brand}` : null,
    spec.standard ? `Standard: ${spec.standard}` : null,
    spec.boqUnit ? `BOQ unit: ${spec.boqUnit}` : null,
    `Country: ${spec.country}`,
    spec.province ? `Province: ${spec.province}` : null,
    spec.town ? `Town: ${spec.town}` : null,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

type CitedSource = { url: string; title: string };

/** Pulls the web-search tool's own grounding citations off the response — never the model's self-reported URLs — so step 2 can be constrained to only these. */
function extractCitedSources(response: OpenAI.Responses.Response): CitedSource[] {
  const cited = new Map<string, CitedSource>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type === "url_citation") {
          cited.set(annotation.url, { url: annotation.url, title: annotation.title });
        }
      }
    }
  }
  return Array.from(cited.values());
}

const RESEARCH_SYSTEM_PROMPT = `You are researching CURRENT South African commercial pricing for a construction material/product using web search. You must actually search the web — do not answer from memory.

Rules:
- Strongly prioritise credible South African manufacturers, builders' merchants, hardware retailers, and specialist construction/electrical/plumbing/civil suppliers (typically .co.za sites, or explicitly South African businesses). Search for South African sources first and specifically.
- Only include an international/non-South-African source if you cannot find adequate South African pricing for this item — and say explicitly in your findings that the source is international/foreign, not South African.
- Do not assume a single supplier represents the whole market.
- Do not prefer an unknown marketplace or classified listing over an established manufacturer or merchant.
- Report prices, units, VAT treatment, and specifications exactly as stated on the source — never estimate or infer a price that isn't shown.
- If a page describes the product/service but does not publish an actual price (e.g. "contact us for a quote", a generic service description with no rate), report it as a source with NO price rather than guessing or inventing one — do not write "R0" or any other placeholder price.
- If the specified brand/model/spec isn't available, you may report a comparable/substitute product, but say so explicitly.
- If you cannot find credible current pricing, say so plainly instead of guessing.
- For every price you report, name the supplier and describe the product close to how the source describes it, including the exact price if one is published, unit/pricing basis (each/per metre/per length/per pack/per kg/etc.), pack or length quantity if relevant, and VAT status if stated.`;

const evidenceItemSchema = z.object({
  supplierName: z.string(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().describe("Must be exactly one of the ALLOWED SOURCE URLS provided — never invent or alter a URL."),
  productDescription: z.string(),
  manufacturer: z.string().nullable(),
  brand: z.string().nullable(),
  specification: z.string().nullable(),
  dimensions: z.string().nullable(),
  sourcePrice: z
    .number()
    .nullable()
    .describe(
      "The actual numeric price stated on the source. Null if the source does NOT publish an actual price (e.g. a service description, 'contact us for a quote', or a generic informational page) — never use 0 or any other placeholder for 'no price found'.",
    ),
  currency: z.string(),
  vatStatus: z.enum(["inclusive", "exclusive", "unknown"]),
  pricingBasis: z.enum(["each", "metre", "length", "pack", "box", "kg", "tonne", "litre", "m2", "m3", "day", "hour", "other"]),
  packQuantity: z.number().nullable().describe("Quantity the source price covers when pricingBasis is 'length' (metres) or 'pack'/'box' (count). Null otherwise."),
  deliveryStatus: z.string().nullable(),
  geographicRelevance: z.string().nullable(),
  evidenceClassification: z.enum([
    "material_product_price",
    "supply_only_price",
    "supply_and_install_price",
    "installed_service_rate",
    "equipment_hire_rate",
    "subcontractor_specialist_price",
    "other",
    "unknown",
  ]),
  matchType: z.enum(["exact", "comparable", "unknown"]).describe("'exact' only if the source matches the requested specification/brand precisely; 'comparable' for a substitute; never silently upgrade a substitute to exact."),
  sourceDate: z.string().nullable().describe("ISO date only if explicitly shown on the source (e.g. a 'last updated' date). Null otherwise — never guess."),
  notes: z.string().nullable(),
});

const extractionSchema = z.object({
  noReliablePriceFound: z.boolean().describe("True if no credible current price could be found for this item — evidence must then be empty."),
  evidence: z.array(evidenceItemSchema).max(marketResearchConfig.maxSourcesPerRun),
});

/**
 * Two-step design, deliberately not one call:
 *  1. A Responses API call with the `web_search` tool, free-text output —
 *     this is the only step that actually touches the web, and the only
 *     step whose citations (annotations) are trustworthy grounding rather
 *     than the model's self-report.
 *  2. A structured-output chat-completion call (the existing
 *     extractStructuredRows helper — no second AI integration built) that
 *     turns that free-text research into typed evidence, explicitly
 *     constrained to only use the URLs found in step 1's citations.
 * normaliseEvidence() then cross-checks every returned sourceUrl against
 * those same citations again, so a fabricated URL is caught even if the
 * model in step 2 ignored the instruction (spec §7, §23, §32).
 */
async function research(spec: MarketSearchSpecification): Promise<MarketResearchProviderResult> {
  const client = getClient();

  let searchResponse: OpenAI.Responses.Response;
  try {
    searchResponse = await client.responses.create({
      model: marketResearchConfig.webSearchModel,
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: RESEARCH_SYSTEM_PROMPT },
        { role: "user", content: `Find current commercial pricing for:\n\n${describeSpec(spec)}` },
      ],
    });
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Web search request failed." };
  }

  const citedSources = extractCitedSources(searchResponse);
  const findingsText = searchResponse.output_text?.trim() ?? "";

  if (citedSources.length === 0 || !findingsText) {
    return { status: "no_result", reason: "No web sources were found for this specification." };
  }

  const allowedUrlsList = citedSources.map((s) => `- ${s.url} (${s.title})`).join("\n");

  let extracted: z.infer<typeof extractionSchema>;
  try {
    extracted = await extractStructuredRows({
      systemPrompt:
        "You extract structured pricing evidence from a web-research findings report. You may only cite a source URL if it appears verbatim in the ALLOWED SOURCE URLS list — never invent, guess, or alter a URL. Never fabricate a price, supplier, or specification that isn't in the findings text. If the findings text does not state an actual price for a source, set sourcePrice to null — never write 0 or invent a number.",
      userPrompt: `FINDINGS:\n${findingsText}\n\nALLOWED SOURCE URLS:\n${allowedUrlsList}`,
      schema: extractionSchema,
      schemaName: "market_research_evidence",
    });
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Could not extract structured evidence from research findings." };
  }

  const allowedUrls = new Set(citedSources.map((s) => s.url));
  const evidence: MarketEvidenceItem[] = extracted.evidence.filter((item) => allowedUrls.has(item.sourceUrl));

  if (extracted.noReliablePriceFound || evidence.length === 0) {
    return { status: "no_result", reason: "No reliable current market price found." };
  }

  return { status: "complete", evidence, citedUrls: citedSources.map((s) => s.url) };
}

export const openAiWebSearchProvider: MarketResearchProvider = {
  name: "openai_web_search",
  isConfigured: isOpenAiWebSearchConfigured,
  research,
};
