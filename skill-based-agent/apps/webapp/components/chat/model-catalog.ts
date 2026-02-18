export type RuntimeProvider = "openrouter";

export interface AIModelEntry {
  id: string;
  name: string;
  providerId: string;
  runtimeProvider: RuntimeProvider;
  reasoning: {
    budgets: string[];
    defaultValue: string;
  };
  contextLimits: {
    total: number;
    maxInput: number;
    maxOutput: number;
  };
  pricing: {
    inputUsdPerMillion: number | null;
    outputUsdPerMillion: number | null;
  };
}

export interface AIModelProviderEntry {
  id: string;
  name: string;
  models: AIModelEntry[];
}

export interface ModelSelectionLike {
  providerId: string;
  modelId: string;
  reasoningBudget: string;
}

export function getProviderById(
  providers: AIModelProviderEntry[],
  providerId: string,
): AIModelProviderEntry | undefined {
  return providers.find((provider) => provider.id === providerId);
}

export function getModelById(
  providers: AIModelProviderEntry[],
  providerId: string,
  modelId: string,
): AIModelEntry | undefined {
  const provider = getProviderById(providers, providerId);
  return provider?.models.find((model) => model.id === modelId);
}

export function getModelReasoningById(
  providers: AIModelProviderEntry[],
  providerId: string,
  modelId: string,
): AIModelEntry["reasoning"] | undefined {
  return getModelById(providers, providerId, modelId)?.reasoning;
}

export function resolveModelSelection(
  providers: AIModelProviderEntry[],
  defaultSelection: ModelSelectionLike,
  modelSelection?: Partial<ModelSelectionLike>,
): ModelSelectionLike {
  const providerId = modelSelection?.providerId ?? defaultSelection.providerId;
  const modelId = modelSelection?.modelId ?? defaultSelection.modelId;

  const selectedModel = getModelById(providers, providerId, modelId);
  const fallbackModel = getModelById(
    providers,
    defaultSelection.providerId,
    defaultSelection.modelId,
  );

  const resolvedModel = selectedModel ?? fallbackModel;

  if (!resolvedModel) {
    return {
      providerId: defaultSelection.providerId,
      modelId: defaultSelection.modelId,
      reasoningBudget: defaultSelection.reasoningBudget,
    };
  }

  const requestedBudget = modelSelection?.reasoningBudget;
  const reasoningBudget =
    requestedBudget && resolvedModel.reasoning.budgets.includes(requestedBudget)
      ? requestedBudget
      : resolvedModel.reasoning.defaultValue;

  return {
    providerId: resolvedModel.providerId,
    modelId: resolvedModel.id,
    reasoningBudget,
  };
}
