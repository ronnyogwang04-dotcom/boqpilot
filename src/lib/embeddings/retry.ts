export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  /** Injectable for tests — defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Called before each retry attempt (not the first try) — for progress logging. */
  onRetry?: (attempt: number, error: unknown) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` with exponential backoff (baseDelayMs * 2^attempt). Used
 * only around the OpenAI call — chunk-level, not item-level, so a
 * transient failure re-embeds a whole batch rather than issuing N single
 * retries.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs, sleep = defaultSleep, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      onRetry?.(attempt + 1, error);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
