import assert from "node:assert";
import type { LanguageModel } from "ai";
import {
  createOpenRouter,
  type OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import type { Logger } from "@protean/logger";
import type { ModelSelection } from "@protean/model-catalog";

export function createModelFromSelection(
  modelSelection: ModelSelection,
  logger: Logger,
): LanguageModel {
  if (modelSelection.providerId === "openrouter") {
    assert(process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY is needed.");

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:3004",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "protean-chatapp",
      },
    });

    logger.debug("Model config:", modelSelection);

    let reasoning: OpenRouterProviderOptions["reasoning"] = {
      enabled: false,
      effort: "none",
    };

    if (modelSelection.reasoningBudget !== "none") {
      reasoning = {
        enabled: true,
        effort: modelSelection.reasoningBudget as
          | "high"
          | "medium"
          | "low"
          | "none",
      };
    }

    return openrouter(modelSelection.modelId, {
      reasoning,
      provider: {
        order: ["fireworks"],
        allow_fallbacks: true,
        sort: "throughput",
      },
    });
  }

  throw new Error(`Unsupported runtime provider: ${modelSelection.providerId}`);
}
