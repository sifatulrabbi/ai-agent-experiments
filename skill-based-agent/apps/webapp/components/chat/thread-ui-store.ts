"use client";

import { create } from "zustand";
import type { ReasoningBudget } from "@/components/chat/model-catalog";

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
    modelId: string;
    providerId: string;
    reasoningBudget: ReasoningBudget;
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

export const useThreadUiStore = create<ThreadUiStore>()((set) => ({
  activeThreadId: null,
  deepResearchEnabled: false,
  imageCreationEnabled: false,
  isCreatingThread: false,
  selectedModelId: "",
  selectedProviderId: "",
  thinkingBudget: "none",

  hydrateFromRoute: ({ modelId, providerId, reasoningBudget, threadId }) => {
    set({
      activeThreadId: threadId,
      isCreatingThread: false,
      selectedModelId: modelId,
      selectedProviderId: providerId,
      thinkingBudget: reasoningBudget,
    });
  },

  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),

  setDeepResearchEnabled: (deepResearchEnabled) => set({ deepResearchEnabled }),

  setImageCreationEnabled: (imageCreationEnabled) =>
    set({ imageCreationEnabled }),

  setIsCreatingThread: (isCreatingThread) => set({ isCreatingThread }),

  setModelSelection: ({ modelId, providerId, thinkingBudget }) => {
    set((state) => ({
      selectedModelId: modelId,
      selectedProviderId: providerId,
      thinkingBudget: thinkingBudget ?? state.thinkingBudget,
    }));
  },

  setThinkingBudget: (thinkingBudget) => set({ thinkingBudget }),
}));
