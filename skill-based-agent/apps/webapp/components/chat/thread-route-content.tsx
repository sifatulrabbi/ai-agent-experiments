"use client";

import type { UIMessage } from "ai";
import { ThreadErrorAlert } from "@/components/chat/thread-error-alert";
import { ThreadHeader } from "@/components/chat/thread-header";
import type { AIModelProviderEntry } from "@/components/chat/model-catalog";
import { ThreadMessages } from "@/components/chat/thread-messages";
import { ThreadPromptInput } from "@/components/chat/thread-user-input";
import { useThreadChat } from "@/components/chat/use-thread-chat";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

interface ThreadRouteContentProps {
  defaultModelSelection: ThreadModelSelection;
  initialMessages?: UIMessage[];
  initialThreadId?: string;
  initialModelSelection?: ThreadModelSelection;
  providers: AIModelProviderEntry[];
}

export function ThreadRouteContent({
  defaultModelSelection,
  initialMessages = [],
  initialThreadId,
  initialModelSelection,
  providers,
}: ThreadRouteContentProps) {
  const {
    activeThreadId,
    error,
    isCreatingThread,
    messages,
    selectedModelId,
    selectedProviderId,
    status,
    thinkingBudget,
    handleEditUserMessage,
    handleModelChange,
    handleRerunAssistantMessage,
    handleThinkingBudgetChange,
    handleSubmit,
    stop,
  } = useThreadChat({
    defaultModelSelection,
    initialMessages,
    initialModelSelection,
    initialThreadId,
    providers,
  });

  return (
    <>
      <ThreadHeader activeThreadId={activeThreadId} />

      <ThreadMessages
        currentModelSelection={{
          modelId: selectedModelId,
          providerId: selectedProviderId,
        }}
        onEditUserMessage={handleEditUserMessage}
        onRerunAssistantMessage={handleRerunAssistantMessage}
        messages={messages}
        providers={providers}
        status={status}
      />

      {error ? <ThreadErrorAlert message={error.message} /> : null}

      <ThreadPromptInput
        disabled={isCreatingThread}
        modelSelection={{
          modelId: selectedModelId,
          providerId: selectedProviderId,
        }}
        onModelChange={handleModelChange}
        onStop={stop}
        onSubmit={handleSubmit}
        onThinkingBudgetChange={handleThinkingBudgetChange}
        providers={providers}
        status={status}
        thinkingBudget={thinkingBudget}
      />
    </>
  );
}
