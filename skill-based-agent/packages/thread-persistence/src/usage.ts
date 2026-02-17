import type {
  ContextSize,
  ThreadMessageRecord,
  ThreadPricingCalculator,
  ThreadUsage,
} from "./types";

export function emptyUsage(): ThreadUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalDurationMs: 0,
    totalCostUsd: 0,
  };
}

export function emptyContextSize(): ContextSize {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };
}

export function aggregateThreadUsage(
  history: ThreadMessageRecord[],
): ThreadUsage {
  const activeMessages = history.filter(
    (message) => message.deletedAt === null,
  );

  return activeMessages.reduce<ThreadUsage>(
    (acc, message) => ({
      inputTokens: acc.inputTokens + message.usage.inputTokens,
      outputTokens: acc.outputTokens + message.usage.outputTokens,
      totalDurationMs: acc.totalDurationMs + message.usage.totalDurationMs,
      totalCostUsd: acc.totalCostUsd + message.usage.totalCostUsd,
    }),
    emptyUsage(),
  );
}

export function aggregateContextSize(
  history: ThreadMessageRecord[],
): ContextSize {
  const activeMessages = history.filter(
    (message) => message.deletedAt === null,
  );

  return activeMessages.reduce<ContextSize>(
    (acc, message) => ({
      totalInputTokens: acc.totalInputTokens + message.usage.inputTokens,
      totalOutputTokens: acc.totalOutputTokens + message.usage.outputTokens,
    }),
    emptyContextSize(),
  );
}

export function resolveMessageCost(args: {
  inputTokens: number;
  outputTokens: number;
  explicitCostUsd?: number;
  modelId?: string;
  pricingCalculator?: ThreadPricingCalculator;
}): number {
  if (typeof args.explicitCostUsd === "number") {
    return args.explicitCostUsd;
  }

  if (!args.pricingCalculator) {
    return 0;
  }

  return args.pricingCalculator.calculateCost({
    modelId: args.modelId ?? "unknown",
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
  });
}
