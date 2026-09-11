import OpenAI from "openai";
import { embeddingConfig } from "@/config/embeddings";

/**
 * Whether a live OpenAI call is even possible right now. Every code path
 * that can run during build/tests/dry-run checks this FIRST and never
 * constructs a client or calls createEmbeddings() when it's false — the key
 * is read lazily (inside this function and getClient(), not at module load)
 * so importing this file never throws just because the env var is unset.
 */
export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — cannot call the OpenAI embeddings API.");
  }
  cachedClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

/**
 * Embeds a batch of texts in a single OpenAI request (never one request per
 * item). Throws if OPENAI_API_KEY isn't set — callers are expected to check
 * isEmbeddingConfigured() first and fail gracefully before ever reaching
 * here (see backfill.ts).
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();
  const response = await client.embeddings.create({
    model: embeddingConfig.model,
    input: texts,
    dimensions: embeddingConfig.dimensions,
  });

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
