import type {
  ContextSize,
  ThreadMessageRecord,
  ThreadPricingCalculator,
  ThreadUsage,
} from "./types";

/** Returns a zeroed-out {@link ThreadUsage} object. Used as the initial accumulator. */
export function emptyUsage(): ThreadUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalDurationMs: 0,
    totalCostUsd: 0,
  };
}

/** Returns a zeroed-out {@link ContextSize} object. Used as the initial accumulator. */
export function emptyContextSize(): ContextSize {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };
}

/**
 * Sums token counts, duration, and cost across all non-deleted messages in `history`.
 *
 * Soft-deleted messages (`deletedAt !== null`) are excluded so that their
 * tokens don't inflate the reported totals after compaction.
 *
 * @param history - The full `ThreadRecord.history` array.
 */
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

/**
 * Computes the active context-window token counts from non-deleted messages.
 *
 * Unlike {@link aggregateThreadUsage}, this is typically called on
 * `activeHistory` rather than the full `history` to reflect what the model
 * currently sees in its context window.
 *
 * @param history - Usually `ThreadRecord.activeHistory`.
 */
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

/**
 * Determines the USD cost for a single message.
 *
 * Resolution order:
 * 1. Use `explicitCostUsd` if the caller already knows the cost (e.g. from an API response).
 * 2. Delegate to `pricingCalculator` if one was provided at `createFsMemory` time.
 * 3. Return `0` as a safe default when neither is available.
 */
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
