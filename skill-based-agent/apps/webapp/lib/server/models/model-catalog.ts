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

const modelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    providerId: z.string().min(1),
    runtimeProvider: z.literal("openrouter"),
    reasoning: z.object({
      budgets: z.array(reasoningBudgetSchema).min(1),
      defaultValue: reasoningBudgetSchema,
    }),
  })
  .superRefine((model, ctx) => {
    if (!model.reasoning.budgets.includes(model.reasoning.defaultValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasoning.defaultValue must be one of reasoning.budgets",
      });
    }
  });

const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  models: z.array(modelSchema).min(1),
});

const catalogSchema = z.object({
  providers: z.array(providerSchema).min(1),
});

const parsedCatalog = catalogSchema.parse(catalogJson);

const providers: AIModelProviderEntry[] = parsedCatalog.providers.map(
  (provider) => ({
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
    })),
  }),
);

const modelByKey = new Map<string, AIModelEntry>();

for (const provider of providers) {
  for (const model of provider.models) {
    modelByKey.set(`${provider.id}:${model.id}`, model);
  }
}

const defaultModelSelection = (() => {
  const firstProvider = providers[0];
  const firstModel = firstProvider?.models[0];

  if (!firstProvider || !firstModel) {
    throw new Error("Model catalog is empty");
  }

  return {
    providerId: firstProvider.id,
    modelId: firstModel.id,
    reasoningBudget: firstModel.reasoning.defaultValue,
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
