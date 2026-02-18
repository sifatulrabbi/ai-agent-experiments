import { z } from "zod";
import type { ThreadModelSelection } from "@protean/agent-memory";
import {
  findModel,
  getDefaultModelSelection,
} from "@/lib/server/models/model-catalog";

export type { ThreadModelSelection };

export interface IncomingModelSelection {
  providerId: string;
  modelId: string;
  reasoningBudget?: string;
}

const strictModelSelectionSchema = z.object({
  modelId: z.string().min(1),
  providerId: z.string().min(1),
  reasoningBudget: z.enum(["none", "low", "medium", "high"]),
});

const looseModelSelectionSchema = z.object({
  modelId: z.string().min(1),
  providerId: z.string().min(1),
  reasoningBudget: z.enum(["none", "low", "medium", "high"]).optional(),
});

export function parseStrictModelSelection(
  input: unknown,
): ThreadModelSelection | undefined {
  const parsed = strictModelSelectionSchema.safeParse(input);

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
}

export function parseLooseModelSelection(
  input: unknown,
): IncomingModelSelection | undefined {
  const parsed = looseModelSelectionSchema.safeParse(input);

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
}

/**
 * Ensures the model id and reasoning budget are valid
 */
export function normalizeThreadModelSelection(
  selection?: ThreadModelSelection,
): ThreadModelSelection {
  const defaultSelection = getDefaultModelSelection();

  if (!selection) {
    return defaultSelection;
  }

  const model = findModel(selection.providerId, selection.modelId);
  if (!model) {
    return defaultSelection;
  }

  return {
    providerId: selection.providerId,
    modelId: selection.modelId,
    reasoningBudget:
      model.reasoning.budgets.find(
        (budget) => budget === selection.reasoningBudget,
      ) ?? model.reasoning.defaultValue,
  };
}

export function resolveModelSelection(args: {
  requestSelection?: IncomingModelSelection;
  threadSelection?: ThreadModelSelection;
}): ThreadModelSelection {
  const defaultSelection = getDefaultModelSelection();
  const candidates: (
    | IncomingModelSelection
    | ThreadModelSelection
    | undefined
  )[] = [args.requestSelection, args.threadSelection, defaultSelection];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const model = findModel(candidate.providerId, candidate.modelId);
    if (!model) {
      continue;
    }

    const requestedBudget = candidate.reasoningBudget;
    const reasoningBudget =
      requestedBudget &&
      model.reasoning.budgets.find((budget) => budget === requestedBudget)
        ? requestedBudget
        : model.reasoning.defaultValue;

    return {
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      reasoningBudget,
    };
  }

  return defaultSelection;
}

export function isSameModelSelection(
  a: ThreadModelSelection | undefined,
  b: ThreadModelSelection,
): boolean {
  if (!a) {
    return false;
  }

  return (
    a.providerId === b.providerId &&
    a.modelId === b.modelId &&
    a.reasoningBudget === b.reasoningBudget
  );
}
