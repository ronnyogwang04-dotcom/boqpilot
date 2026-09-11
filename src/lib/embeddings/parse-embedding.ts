// supabase-js returns pgvector columns as their bracket-text wire format
// (e.g. "[-0.042,...]"), not a parsed array, despite database.types.ts
// typing `embedding` as `number[] | null`. This is the one place that
// bridges that gap — every other embeddings module either never touches
// the raw column or already receives a parsed number[].
export function parseStoredEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}
