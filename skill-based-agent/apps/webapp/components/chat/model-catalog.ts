export type ReasoningBudget = "none" | "low" | "medium" | "high";

export interface AIModelEntry {
  id: string;
  name: string;
  provider: string;
  reasoning: {
    budgets: ReasoningBudget[];
    defaultValue: ReasoningBudget;
  };
}

export interface AIModelProviderEntry {
  id: string;
  name: string;
  models: AIModelEntry[];
}
export const ModelsCatalogue: AIModelProviderEntry[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      {
        id: "openai/gpt-5.2",
        name: "GPT-5.2",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
      {
        id: "openai/gpt-4.1",
        name: "GPT-4.1",
        reasoning: {
          budgets: ["none"],
          defaultValue: "none",
        },
        provider: "openrouter",
      },
      {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120b",
        reasoning: {
          budgets: ["low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic AI",
    models: [
      {
        id: "anthropic/claude-opus-4.6",
        name: "Claude Opus 4.6",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude 4.5 Sonnet",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
    ],
  },
  {
    id: "moonshotai",
    name: "Moonshoot AI",
    models: [
      {
        id: "moonshotai/kimi-k2.5",
        name: "Kimi K2.5",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    models: [
      {
        id: "google/gemini-3-flash-preview",
        name: "Gemini 3 flash preview",
        reasoning: {
          budgets: ["none", "low", "medium", "high"],
          defaultValue: "medium",
        },
        provider: "openrouter",
      },
    ],
  },
];

export const DEFAULT_CHAT_PROVIDER_ID = ModelsCatalogue[0]?.id ?? "openai";
export const DEFAULT_CHAT_MODEL_ID =
  ModelsCatalogue[0]?.models[0]?.id ?? "openai/gpt-5.2";

export const DEFAULT_CHAT_PROVIDER_RUNTIME =
  ModelsCatalogue[0]?.models[0]?.provider ?? "openrouter";

export function getProviderById(
  providerId: string,
): AIModelProviderEntry | undefined {
  return ModelsCatalogue.find((provider) => provider.id === providerId);
}

export function getModelById(
  providerId: string,
  modelId: string,
): AIModelEntry | undefined {
  const provider = getProviderById(providerId);
  return provider?.models.find((model) => model.id === modelId);
}

export function getModelProviderRuntimeById(
  providerId: string,
  modelId: string,
): string | undefined {
  return getModelById(providerId, modelId)?.provider;
}

export function getModelReasoningById(
  providerId: string,
  modelId: string,
): AIModelEntry["reasoning"] | undefined {
  return getModelById(providerId, modelId)?.reasoning;
}
