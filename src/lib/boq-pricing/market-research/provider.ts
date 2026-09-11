import { marketResearchConfig } from "@/config/market-research";
import type { MarketResearchProvider } from "./types";
import { openAiWebSearchProvider } from "./providers/openai-web-search-provider";

/**
 * The single seam BOQPilot's pricing logic depends on — service.ts,
 * actions, and the UI only ever call through MarketResearchProvider, never
 * reference "openai" or "web search" directly. Adding a future provider
 * (specialist search API, supplier API, procurement database) means
 * implementing MarketResearchProvider and adding one case here; nothing
 * else in the pricing pipeline changes.
 */
export function getMarketResearchProvider(): MarketResearchProvider {
  switch (marketResearchConfig.activeProvider) {
    case "openai_web_search":
      return openAiWebSearchProvider;
  }
}
