"use client";

import { create } from "zustand";
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_CHAT_PROVIDER_ID,
  getModelReasoningById,
  type ReasoningBudget,
} from "@/components/chat/model-catalog";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

interface ThreadUiStore {
  activeThreadId: string | null;
  deepResearchEnabled: boolean;
  imageCreationEnabled: boolean;
  isCreatingThread: boolean;
  selectedModelId: string;
  selectedProviderId: string;
  thinkingBudget: ReasoningBudget;
  hydrateFromRoute: (args: {
    threadId: string | null;
    modelSelection?: ThreadModelSelection;
  }) => void;
  setActiveThreadId: (threadId: string | null) => void;
  setDeepResearchEnabled: (enabled: boolean) => void;
  setImageCreationEnabled: (enabled: boolean) => void;
  setIsCreatingThread: (isCreating: boolean) => void;
  setModelSelection: (args: {
    modelId: string;
    providerId: string;
    thinkingBudget?: ReasoningBudget;
  }) => void;
  setThinkingBudget: (budget: ReasoningBudget) => void;
}

function resolveSelection(modelSelection?: ThreadModelSelection) {
  const providerId = modelSelection?.providerId ?? DEFAULT_CHAT_PROVIDER_ID;
  const modelId = modelSelection?.modelId ?? DEFAULT_CHAT_MODEL_ID;
  const reasoning = getModelReasoningById(providerId, modelId);
  const reasoningBudget =
    modelSelection?.reasoningBudget &&
    reasoning?.budgets.includes(modelSelection.reasoningBudget)
      ? modelSelection.reasoningBudget
      : (reasoning?.defaultValue ?? "none");

  return {
    modelId,
    providerId,
    reasoningBudget,
  };
}

export const useThreadUiStore = create<ThreadUiStore>()((set) => {
  const initial = resolveSelection();

  return {
    activeThreadId: null,
    deepResearchEnabled: false,
    imageCreationEnabled: false,
    isCreatingThread: false,
    selectedModelId: initial.modelId,
    selectedProviderId: initial.providerId,
    thinkingBudget: initial.reasoningBudget,

    hydrateFromRoute: ({ threadId, modelSelection }) => {
      const selection = resolveSelection(modelSelection);
      set({
        activeThreadId: threadId,
        isCreatingThread: false,
        selectedModelId: selection.modelId,
        selectedProviderId: selection.providerId,
        thinkingBudget: selection.reasoningBudget,
      });
    },

    setActiveThreadId: (activeThreadId) => set({ activeThreadId }),

    setDeepResearchEnabled: (deepResearchEnabled) =>
      set({ deepResearchEnabled }),

    setImageCreationEnabled: (imageCreationEnabled) =>
      set({ imageCreationEnabled }),

    setIsCreatingThread: (isCreatingThread) => set({ isCreatingThread }),

    setModelSelection: ({ modelId, providerId, thinkingBudget }) => {
      const reasoning = getModelReasoningById(providerId, modelId);
      set({
        selectedModelId: modelId,
        selectedProviderId: providerId,
        thinkingBudget: thinkingBudget ?? reasoning?.defaultValue ?? "none",
      });
    },

    setThinkingBudget: (thinkingBudget) => set({ thinkingBudget }),
  };
});
