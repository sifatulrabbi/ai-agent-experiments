import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { DEFAULT_CHAT_MODEL_ID } from "@/components/chat/model-catalog";

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
    // OpenRouter is OpenAI-chat-completions compatible; using `.chat(...)`
    // avoids Responses-API incompatibilities that can yield empty assistant parts.
    return ProviderFactory.openRouter.chat(modelId);
    // return ProviderFactory.openRouter.responses(modelId);
  }
}

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || DEFAULT_CHAT_MODEL_ID;

export { ProviderFactory };
