import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getDefaultModelSelection } from "@/lib/server/models/model-catalog";

class ProviderFactory {
  static isOpenRouterConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  private static openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL || "http://localhost:3004",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "chatapp-mvp",
    },
  });

  static languageModel(modelId: string): LanguageModelV3 {
    return ProviderFactory.openRouter.chat(modelId);
  }
}

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || getDefaultModelSelection().modelId;

export { ProviderFactory };
