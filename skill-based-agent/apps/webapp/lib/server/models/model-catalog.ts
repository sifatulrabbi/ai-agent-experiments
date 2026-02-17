import { z } from "zod";
import catalogJson from "./models.catalog.json";
import type {
  AIModelEntry,
  AIModelProviderEntry,
  ReasoningBudget,
  RuntimeProvider,
} from "@/components/chat/model-catalog";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

const reasoningBudgetSchema = z.enum(["none", "low", "medium", "high"]);

const legacyModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    providerId: z.string().min(1),
    runtimeProvider: z.literal("openrouter"),
    reasoning: z.object({
      budgets: z.array(reasoningBudgetSchema).min(1),
      defaultValue: reasoningBudgetSchema,
    }),
    contextLimits: z
      .object({
        total: z.number().int().nonnegative(),
        maxInput: z.number().int().nonnegative(),
        maxOutput: z.number().int().nonnegative(),
      })
      .optional(),
    pricing: z
      .object({
        inputUsdPerMillion: z.number().nonnegative().nullable(),
        outputUsdPerMillion: z.number().nonnegative().nullable(),
      })
      .optional(),
  })
  .superRefine((model, ctx) => {
    if (!model.reasoning.budgets.includes(model.reasoning.defaultValue)) {
      ctx.addIssue({
        code: "custom",
        message: "reasoning.defaultValue must be one of reasoning.budgets",
      });
    }
  });

const legacyProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  models: z.array(legacyModelSchema).min(1),
});

const legacyCatalogSchema = z.object({
  providers: z.array(legacyProviderSchema).min(1),
});

const openRouterModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  context_length: z.number().int().positive(),
  top_provider: z
    .object({
      context_length: z.number().int().nonnegative().optional(),
      max_completion_tokens: z.number().int().nonnegative().optional(),
    })
    .nullish(),
  pricing: z
    .object({
      prompt: z.union([z.string(), z.number()]).optional(),
      completion: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  supported_parameters: z.array(z.string()).optional(),
});

const openRouterCatalogSchema = z.record(
  z.string().min(1),
  z.array(openRouterModelSchema).min(1),
);

const parsedLegacyCatalog = Array.isArray(
  (catalogJson as { providers?: unknown }).providers,
)
  ? legacyCatalogSchema.parse(catalogJson)
  : undefined;

const parsedOpenRouterCatalog = parsedLegacyCatalog
  ? undefined
  : openRouterCatalogSchema.parse(catalogJson);

function supportsReasoning(supportedParameters: string[]): boolean {
  const normalized = new Set(
    supportedParameters.map((parameter) => parameter.toLowerCase()),
  );

  return (
    normalized.has("reasoning") ||
    normalized.has("include_reasoning") ||
    normalized.has("reasoning_effort")
  );
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function inferProviderName(providerId: string, modelName?: string): string {
  const firstSegment = modelName?.split(":")[0]?.trim();
  if (firstSegment) {
    return firstSegment;
  }

  return toTitleCase(providerId);
}

function buildContextLimitsFromOpenRouterModel(
  model: z.infer<typeof openRouterModelSchema>,
): AIModelEntry["contextLimits"] {
  const providerContextLength =
    typeof model.top_provider?.context_length === "number" &&
    model.top_provider.context_length > 0
      ? model.top_provider.context_length
      : undefined;
  const total = providerContextLength ?? model.context_length;
  const reportedMaxOutput = model.top_provider?.max_completion_tokens;
  const maxOutput =
    typeof reportedMaxOutput === "number" && reportedMaxOutput > 0
      ? Math.min(total, reportedMaxOutput)
      : total;
  const maxInput =
    typeof reportedMaxOutput === "number" && reportedMaxOutput > 0
      ? Math.max(0, total - maxOutput)
      : total;

  return {
    total,
    maxInput,
    maxOutput,
  };
}

function toUsdPerMillion(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed * 1_000_000;
}

function buildPricingFromOpenRouterModel(
  model: z.infer<typeof openRouterModelSchema>,
): AIModelEntry["pricing"] {
  return {
    inputUsdPerMillion: toUsdPerMillion(model.pricing?.prompt),
    outputUsdPerMillion: toUsdPerMillion(model.pricing?.completion),
  };
}

const providers: AIModelProviderEntry[] = parsedLegacyCatalog
  ? parsedLegacyCatalog.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: provider.models.map((model) => ({
        id: model.id,
        name: model.name,
        providerId: model.providerId,
        runtimeProvider: model.runtimeProvider as RuntimeProvider,
        reasoning: {
          budgets: model.reasoning.budgets as ReasoningBudget[],
          defaultValue: model.reasoning.defaultValue as ReasoningBudget,
        },
        contextLimits: model.contextLimits ?? {
          total: 0,
          maxInput: 0,
          maxOutput: 0,
        },
        pricing: model.pricing ?? {
          inputUsdPerMillion: null,
          outputUsdPerMillion: null,
        },
      })),
    }))
  : Object.entries(parsedOpenRouterCatalog ?? {}).map(
      ([providerId, models]) => ({
        id: providerId,
        name: inferProviderName(providerId, models[0]?.name),
        models: models.map((model) => {
          const modelSupportsReasoning = supportsReasoning(
            model.supported_parameters ?? [],
          );
          const budgets: ReasoningBudget[] = modelSupportsReasoning
            ? ["none", "low", "medium", "high"]
            : ["none"];

          return {
            id: model.id,
            name: model.name,
            providerId,
            runtimeProvider: "openrouter" as RuntimeProvider,
            reasoning: {
              budgets,
              defaultValue: modelSupportsReasoning ? "medium" : "none",
            },
            contextLimits: buildContextLimitsFromOpenRouterModel(model),
            pricing: buildPricingFromOpenRouterModel(model),
          };
        }),
      }),
    );

const modelByKey = new Map<string, AIModelEntry>();

for (const provider of providers) {
  for (const model of provider.models) {
    modelByKey.set(`${provider.id}:${model.id}`, model);
  }
}

const defaultModelSelection = (() => {
  const provider = providers.find((p) => p.id === "stepfun");

  let model = provider?.models.find(
    (m) => m.id === "stepfun/step-3.5-flash:free",
  );
  // in case the free is not available anymore
  if (!model && provider) {
    model = provider?.models.find((m) => m.id === "stepfun/step-3.5-flash");
  }

  if (!provider || !model) {
    throw new Error("Model catalog is empty");
  }

  return {
    providerId: provider.id,
    modelId: model.id,
    reasoningBudget: model.reasoning.defaultValue,
  } satisfies ThreadModelSelection;
})();

export function getModelCatalog(): AIModelProviderEntry[] {
  return providers;
}

export function getDefaultModelSelection(): ThreadModelSelection {
  return defaultModelSelection;
}

export function findModel(
  providerId: string,
  modelId: string,
): AIModelEntry | undefined {
  return modelByKey.get(`${providerId}:${modelId}`);
}
