"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useShallow } from "zustand/react/shallow";
import type { ModelSelection } from "@protean/model-catalog";
import {
  getModelReasoningById,
  resolveClientModelSelection,
  type AIModelProviderEntry,
} from "@protean/model-catalog";
import { useThreadApi } from "@/components/chat/use-thread-api";
import { useThreadUiStore } from "@/components/chat/thread-ui-store";
import type { ThreadStatus } from "@/components/chat/thread-ui-shared";

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
  defaultModelSelection: ModelSelection;
  initialMessages: UIMessage[];
  initialModelSelection?: ModelSelection;
  initialThreadId?: string;
  providers: AIModelProviderEntry[];
}

export interface UseThreadChatResult {
  activeThreadId: string | null;
  error: Error | undefined;
  handleEditUserMessage: (payload: {
    messageId: string;
    modelSelection?: ModelSelection;
    text: string;
  }) => Promise<void>;
  handleModelChange: (selection: ModelSelection) => void;
  handleRerunAssistantMessage: (payload: {
    messageId: string;
    modelSelection?: ModelSelection;
  }) => Promise<void>;
  handleSubmit: (payload: { text: string }) => Promise<void>;
  handleReasoningBudgetChange: (budget: string) => void;
  isCreatingThread: boolean;
  messages: UIMessage[];
  modelSelection: ModelSelection;
  status: ThreadStatus;
  stop: () => void;
}

export function useThreadChat({
  defaultModelSelection,
  initialMessages,
  initialModelSelection,
  initialThreadId,
  providers,
}: UseThreadChatArgs): UseThreadChatResult {
  const router = useRouter();
  const { addMessage, createThread, editMessage, updateThreadModelSelection } =
    useThreadApi();

  const {
    activeThreadId,
    isCreatingThread,
    modelSelection: storeModelSelection,
  } = useThreadUiStore(
    useShallow((state) => ({
      activeThreadId: state.activeThreadId,
      isCreatingThread: state.isCreatingThread,
      modelSelection: state.modelSelection,
    })),
  );

  const initialSelection = useMemo(
    () =>
      resolveClientModelSelection(
        providers,
        defaultModelSelection,
        initialModelSelection,
      ),
    [defaultModelSelection, initialModelSelection, providers],
  );

  const threadIdRef = useRef<string | null>(initialThreadId ?? null);

  useEffect(() => {
    useThreadUiStore.getState().hydrateFromRoute({
      modelSelection: initialSelection,
      threadId: initialThreadId ?? null,
    });

    threadIdRef.current = initialThreadId ?? null;
  }, [initialSelection, initialThreadId]);

  const refreshSidebar = useCallback(() => {
    router.refresh();
  }, [router]);

  const persistThreadModelSelection = useCallback(
    async (selection: ModelSelection) => {
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

  const applyInvocationModelSelection = useCallback(
    async (
      overrideSelection?: ModelSelection,
    ): Promise<ModelSelection | undefined> => {
      if (!overrideSelection) {
        return undefined;
      }

      const resolved = resolveClientModelSelection(
        providers,
        useThreadUiStore.getState().modelSelection,
        overrideSelection,
      );

      useThreadUiStore.getState().setModelSelection(resolved);
      await persistThreadModelSelection(resolved);

      return resolved;
    },
    [persistThreadModelSelection, providers],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/agent/chat",
        prepareSendMessagesRequest: ({ api, body, id, trigger }) => {
          const bodyAsRecord = body as Record<string, unknown> | undefined;
          const modelSelectionFromBody = bodyAsRecord?.modelSelection as
            | ModelSelection
            | undefined;

          return {
            api,
            body: {
              ...body,
              id,
              modelSelection:
                modelSelectionFromBody ??
                useThreadUiStore.getState().modelSelection,
              threadId: threadIdRef.current,
              trigger,
            },
          };
        },
      }),
    [],
  );

  const pendingPromptHandledThreadsRef = useRef(new Set<string>());
  const [isPersistingMessageMutation, setIsPersistingMessageMutation] =
    useState(false);

  const { error, messages, regenerate, sendMessage, setMessages, status, stop } =
    useChat({
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

      const userMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: trimmedText }],
      };

      const store = useThreadUiStore.getState();
      if (!threadIdRef.current) {
        store.setIsCreatingThread(true);
        setMessages((currentMessages) => [...currentMessages, userMessage]);

        try {
          const threadId = await createThread({
            initialUserMessage: trimmedText,
            modelSelection: store.modelSelection,
            title: trimmedText.slice(0, 60),
          });

          threadIdRef.current = threadId;
          store.setActiveThreadId(threadId);

          router.replace(`/chats/t/${threadId}`);
          refreshSidebar();
          return;
        } catch (error) {
          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== userMessage.id),
          );
          throw error;
        } finally {
          useThreadUiStore.getState().setIsCreatingThread(false);
        }
      }

      setMessages((currentMessages) => [...currentMessages, userMessage]);
      setIsPersistingMessageMutation(true);
      let messagePersisted = false;
      try {
        await addMessage({
          threadId: threadIdRef.current,
          message: userMessage,
          modelSelection: useThreadUiStore.getState().modelSelection,
        });
        messagePersisted = true;

        await sendMessage({
          messageId: userMessage.id,
          text: trimmedText,
        });
        refreshSidebar();
      } catch (error) {
        if (!messagePersisted) {
          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== userMessage.id),
          );
        }
        throw error;
      } finally {
        setIsPersistingMessageMutation(false);
      }
    },
    [addMessage, createThread, refreshSidebar, router, sendMessage, setMessages],
  );

  const handleEditUserMessage = useCallback(
    async ({
      messageId,
      modelSelection,
      text,
    }: {
      messageId: string;
      modelSelection?: ModelSelection;
      text: string;
    }) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const threadId = threadIdRef.current;
      if (!threadId) {
        return;
      }

      setIsPersistingMessageMutation(true);
      try {
        const invocationModelSelection =
          await applyInvocationModelSelection(modelSelection);

        const editedMessage: UIMessage = {
          id: messageId,
          role: "user",
          parts: [{ type: "text", text: trimmedText }],
        };

        await editMessage({
          threadId,
          messageId,
          message: editedMessage,
        });

        await sendMessage(
          {
            messageId,
            text: trimmedText,
          },
          invocationModelSelection
            ? {
                body: {
                  modelSelection: invocationModelSelection,
                },
              }
            : undefined,
        );
        refreshSidebar();
      } finally {
        setIsPersistingMessageMutation(false);
      }
    },
    [applyInvocationModelSelection, editMessage, refreshSidebar, sendMessage],
  );

  const handleRerunAssistantMessage = useCallback(
    async ({
      messageId,
      modelSelection,
    }: {
      messageId: string;
      modelSelection?: ModelSelection;
    }) => {
      const invocationModelSelection =
        await applyInvocationModelSelection(modelSelection);

      await regenerate({
        ...(invocationModelSelection
          ? {
              body: {
                modelSelection: invocationModelSelection,
              },
            }
          : {}),
        messageId,
      });
      refreshSidebar();
    },
    [applyInvocationModelSelection, regenerate, refreshSidebar],
  );

  const handleModelChange = useCallback(
    (selection: ModelSelection) => {
      const reasoning = getModelReasoningById(
        providers,
        selection.providerId,
        selection.modelId,
      );
      const resolved: ModelSelection = {
        ...selection,
        reasoningBudget:
          (reasoning?.defaultValue as ModelSelection["reasoningBudget"]) ??
          "none",
      };

      useThreadUiStore.getState().setModelSelection(resolved);
      void persistThreadModelSelection(resolved);
    },
    [persistThreadModelSelection, providers],
  );

  const handleReasoningBudgetChange = useCallback(
    (budget: string) => {
      const current = useThreadUiStore.getState().modelSelection;
      const updated: ModelSelection = {
        ...current,
        reasoningBudget: budget as ModelSelection["reasoningBudget"],
      };

      useThreadUiStore.getState().setModelSelection(updated);
      void persistThreadModelSelection(updated);
    },
    [persistThreadModelSelection],
  );

  // Use store values if hydrated, otherwise fall back to initial selection
  const effectiveModelSelection = storeModelSelection.modelId
    ? storeModelSelection
    : initialSelection;
  const effectiveStatus: ThreadStatus =
    (isCreatingThread || isPersistingMessageMutation) && status === "ready"
      ? "submitted"
      : status;

  return {
    activeThreadId,
    error: error as Error | undefined,
    isCreatingThread,
    messages,
    modelSelection: effectiveModelSelection,
    status: effectiveStatus,
    handleEditUserMessage,
    handleModelChange,
    handleRerunAssistantMessage,
    handleSubmit,
    handleReasoningBudgetChange,
    stop,
  };
}
