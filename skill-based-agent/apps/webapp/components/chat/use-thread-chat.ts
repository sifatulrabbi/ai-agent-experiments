"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useShallow } from "zustand/react/shallow";
import {
  getModelReasoningById,
  resolveModelSelection,
  type AIModelProviderEntry,
  type ReasoningBudget,
} from "@/components/chat/model-catalog";
import { useThreadApi } from "@/components/chat/use-thread-api";
import { useThreadUiStore } from "@/components/chat/thread-ui-store";
import type { ThreadStatus } from "@/components/chat/thread-ui-shared";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

function isPendingMessage(message: UIMessage): boolean {
  const metadata = (
    message as UIMessage & {
      metadata?: unknown;
    }
  ).metadata;

  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return (metadata as Record<string, unknown>).pending === true;
}

interface UseThreadChatArgs {
  defaultModelSelection: ThreadModelSelection;
  initialMessages: UIMessage[];
  initialModelSelection?: ThreadModelSelection;
  initialThreadId?: string;
  providers: AIModelProviderEntry[];
}

interface UseThreadChatResult {
  activeThreadId: string | null;
  error: Error | undefined;
  handleEditUserMessage: (payload: {
    messageId: string;
    text: string;
  }) => Promise<void>;
  handleModelChange: (selection: {
    modelId: string;
    providerId: string;
  }) => void;
  handleRerunAssistantMessage: (payload: {
    messageId: string;
  }) => Promise<void>;
  handleSubmit: (payload: { text: string }) => Promise<void>;
  handleThinkingBudgetChange: (budget: ReasoningBudget) => void;
  isCreatingThread: boolean;
  messages: UIMessage[];
  selectedModelId: string;
  selectedProviderId: string;
  status: ThreadStatus;
  stop: () => void;
  thinkingBudget: ReasoningBudget;
}

export function useThreadChat({
  defaultModelSelection,
  initialMessages,
  initialModelSelection,
  initialThreadId,
  providers,
}: UseThreadChatArgs): UseThreadChatResult {
  const router = useRouter();
  const { createThread, updateThreadModelSelection } = useThreadApi();

  const {
    activeThreadId,
    hydrateFromRoute,
    isCreatingThread,
    selectedModelId,
    selectedProviderId,
    thinkingBudget,
  } = useThreadUiStore(
    useShallow((state) => ({
      activeThreadId: state.activeThreadId,
      hydrateFromRoute: state.hydrateFromRoute,
      isCreatingThread: state.isCreatingThread,
      selectedModelId: state.selectedModelId,
      selectedProviderId: state.selectedProviderId,
      thinkingBudget: state.thinkingBudget,
    })),
  );

  const initialSelection = useMemo(
    () =>
      resolveModelSelection(
        providers,
        defaultModelSelection,
        initialModelSelection,
      ),
    [defaultModelSelection, initialModelSelection, providers],
  );

  const threadIdRef = useRef<string | null>(initialThreadId ?? null);

  useEffect(() => {
    hydrateFromRoute({
      modelId: initialSelection.modelId,
      providerId: initialSelection.providerId,
      reasoningBudget: initialSelection.reasoningBudget,
      threadId: initialThreadId ?? null,
    });

    threadIdRef.current = initialThreadId ?? null;
  }, [hydrateFromRoute, initialSelection, initialThreadId]);

  const selectedProviderRef = useRef(initialSelection.providerId);
  const selectedModelRef = useRef(initialSelection.modelId);
  const thinkingBudgetRef = useRef(initialSelection.reasoningBudget);

  useEffect(() => {
    if (selectedProviderId) {
      selectedProviderRef.current = selectedProviderId;
    }
  }, [selectedProviderId]);

  useEffect(() => {
    if (selectedModelId) {
      selectedModelRef.current = selectedModelId;
    }
  }, [selectedModelId]);

  useEffect(() => {
    thinkingBudgetRef.current = thinkingBudget;
  }, [thinkingBudget]);

  const refreshSidebar = useCallback(() => {
    router.refresh();
  }, [router]);

  const persistThreadModelSelection = useCallback(
    async (selection: ThreadModelSelection) => {
      const threadId = threadIdRef.current;
      if (!threadId) {
        return;
      }

      await updateThreadModelSelection({
        modelSelection: selection,
        threadId,
      });
    },
    [updateThreadModelSelection],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/agent/chat",
        prepareSendMessagesRequest: ({
          api,
          body,
          id,
          messageId,
          messages,
          trigger,
        }) => ({
          api,
          body: {
            ...body,
            id,
            messageId,
            messages,
            modelSelection: {
              modelId: selectedModelRef.current,
              providerId: selectedProviderRef.current,
              reasoningBudget: thinkingBudgetRef.current,
            },
            threadId: threadIdRef.current,
            trigger,
          },
        }),
      }),
    [],
  );

  const pendingPromptHandledThreadsRef = useRef(new Set<string>());

  const { error, messages, regenerate, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    if (!initialThreadId) return;
    if (pendingPromptHandledThreadsRef.current.has(initialThreadId)) return;
    const hasPendingMessage = initialMessages.some(
      (message) => message.role === "user" && isPendingMessage(message),
    );
    if (!hasPendingMessage) return;

    pendingPromptHandledThreadsRef.current.add(initialThreadId);

    void (async () => {
      try {
        await sendMessage(undefined, {
          body: { invokePending: true },
        });
        refreshSidebar();
      } catch {
        pendingPromptHandledThreadsRef.current.delete(initialThreadId);
      }
    })();
  }, [initialMessages, initialThreadId, refreshSidebar, sendMessage]);

  const handleSubmit = useCallback(
    async ({ text }: { text: string }) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const store = useThreadUiStore.getState();
      if (!threadIdRef.current) {
        store.setIsCreatingThread(true);

        try {
          const modelSelection: ThreadModelSelection = {
            modelId: selectedModelRef.current,
            providerId: selectedProviderRef.current,
            reasoningBudget: thinkingBudgetRef.current,
          };

          const threadId = await createThread({
            initialUserMessage: trimmedText,
            modelSelection,
            title: trimmedText.slice(0, 60),
          });

          threadIdRef.current = threadId;
          store.setActiveThreadId(threadId);

          router.replace(`/chats/t/${threadId}`);
          refreshSidebar();
          return;
        } finally {
          useThreadUiStore.getState().setIsCreatingThread(false);
        }
      }

      await sendMessage({ text: trimmedText });
      refreshSidebar();
    },
    [createThread, refreshSidebar, router, sendMessage],
  );

  const handleEditUserMessage = useCallback(
    async ({ messageId, text }: { messageId: string; text: string }) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      await sendMessage({
        messageId,
        text: trimmedText,
      });
      refreshSidebar();
    },
    [refreshSidebar, sendMessage],
  );

  const handleRerunAssistantMessage = useCallback(
    async ({ messageId }: { messageId: string }) => {
      await regenerate({
        messageId,
      });
      refreshSidebar();
    },
    [regenerate, refreshSidebar],
  );

  const handleModelChange = useCallback(
    ({ modelId, providerId }: { modelId: string; providerId: string }) => {
      const reasoning = getModelReasoningById(providers, providerId, modelId);
      const nextBudget = reasoning?.defaultValue ?? "none";

      useThreadUiStore.getState().setModelSelection({
        modelId,
        providerId,
        thinkingBudget: nextBudget,
      });

      void persistThreadModelSelection({
        modelId,
        providerId,
        reasoningBudget: nextBudget,
      });
    },
    [persistThreadModelSelection, providers],
  );

  const handleThinkingBudgetChange = useCallback(
    (budget: ReasoningBudget) => {
      useThreadUiStore.getState().setThinkingBudget(budget);

      void persistThreadModelSelection({
        modelId: selectedModelRef.current,
        providerId: selectedProviderRef.current,
        reasoningBudget: budget,
      });
    },
    [persistThreadModelSelection],
  );

  return {
    activeThreadId,
    error: error as Error | undefined,
    isCreatingThread,
    messages,
    selectedModelId: selectedModelId || initialSelection.modelId,
    selectedProviderId: selectedProviderId || initialSelection.providerId,
    status,
    thinkingBudget: thinkingBudget || initialSelection.reasoningBudget,
    handleEditUserMessage,
    handleModelChange,
    handleRerunAssistantMessage,
    handleSubmit,
    handleThinkingBudgetChange,
    stop,
  };
}
