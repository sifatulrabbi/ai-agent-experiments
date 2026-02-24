"use client";

import { create } from "zustand";
import type { ModelSelection } from "@protean/model-catalog";

interface ThreadUiStore {
  activeThreadId: string | null;
  deepResearchEnabled: boolean;
  imageCreationEnabled: boolean;
  isCreatingThread: boolean;
  modelSelection: ModelSelection;

  hydrateFromRoute: (args: {
    threadId: string | null;
    modelSelection: ModelSelection;
  }) => void;
  setActiveThreadId: (threadId: string | null) => void;
  setDeepResearchEnabled: (enabled: boolean) => void;
  setImageCreationEnabled: (enabled: boolean) => void;
  setIsCreatingThread: (isCreating: boolean) => void;
  setModelSelection: (selection: ModelSelection) => void;
}

const emptyModelSelection: ModelSelection = {
  providerId: "",
  modelId: "",
  reasoningBudget: "none",
  runtimeProvider: "",
};

export const useThreadUiStore = create<ThreadUiStore>()((set) => ({
  activeThreadId: null,
  deepResearchEnabled: false,
  imageCreationEnabled: false,
  isCreatingThread: false,
  modelSelection: emptyModelSelection,

  hydrateFromRoute: ({ modelSelection, threadId }) => {
    set({
      activeThreadId: threadId,
      isCreatingThread: false,
      modelSelection,
    });
  },

  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),

  setDeepResearchEnabled: (deepResearchEnabled) => set({ deepResearchEnabled }),

  setImageCreationEnabled: (imageCreationEnabled) =>
    set({ imageCreationEnabled }),

  setIsCreatingThread: (isCreatingThread) => set({ isCreatingThread }),

  setModelSelection: (modelSelection) => set({ modelSelection }),
}));
