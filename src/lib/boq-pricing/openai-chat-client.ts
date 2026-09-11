import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z, ZodType } from "zod";
import { boqPricingConfig } from "@/config/boq-pricing";

/**
 * Same lazy-key convention as src/lib/embeddings/openai-client.ts: reads
 * process.env.OPENAI_API_KEY only when actually called, never at module
 * load, so importing this file never throws just because the env var is
 * unset. Deliberately a separate client module from embeddings' — chat
 * completions and embeddings are different API surfaces on the same key.
 */
export function isAiExtractionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — cannot run AI-assisted PDF extraction.");
  }
  cachedClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

/**
 * Structured-output chat completion: the model's response is validated
 * against `schema` by the OpenAI SDK itself (strict JSON Schema mode) before
 * this function ever sees it, so a malformed/hallucinated shape fails loudly
 * here rather than silently corrupting downstream data.
 */
export async function extractStructuredRows<TSchema extends ZodType>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: TSchema;
  schemaName: string;
}): Promise<z.infer<TSchema>> {
  const client = getClient();

  const completion = await client.chat.completions.parse({
    model: boqPricingConfig.aiExtractionModel,
    temperature: 0,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    response_format: zodResponseFormat(params.schema, params.schemaName),
  });

  const choice = completion.choices[0];
  if (choice?.message.refusal) {
    throw new Error(`Model refused to extract this page: ${choice.message.refusal}`);
  }
  if (!choice?.message.parsed) {
    throw new Error("Model returned no parseable content for this page.");
  }
  return choice.message.parsed as z.infer<TSchema>;
}
