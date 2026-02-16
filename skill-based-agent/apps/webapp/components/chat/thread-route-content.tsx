"use client";

import type { UIMessage } from "ai";
import { ThreadErrorAlert } from "@/components/chat/thread-error-alert";
import { ThreadHeader } from "@/components/chat/thread-header";
import { ModelsCatalogue } from "@/components/chat/model-catalog";
import { ThreadMessages } from "@/components/chat/thread-messages";
import { ThreadPromptInput } from "@/components/chat/thread-user-input";
import { useThreadChat } from "@/components/chat/use-thread-chat";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

interface ThreadRouteContentProps {
  initialMessages?: UIMessage[];
  initialThreadId?: string;
  initialTitle?: string;
  initialModelSelection?: ThreadModelSelection;
}

export function ThreadRouteContent({
  initialMessages = [],
  initialThreadId,
  initialTitle,
  initialModelSelection,
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
    initialMessages,
    initialModelSelection,
    initialThreadId,
  });

  return (
    <>
      <ThreadHeader activeThreadId={activeThreadId} />

      <ThreadMessages
        onEditUserMessage={handleEditUserMessage}
        onRerunAssistantMessage={handleRerunAssistantMessage}
        messages={messages}
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
        providers={ModelsCatalogue}
        status={status}
        thinkingBudget={thinkingBudget}
      />
    </>
  );
}
