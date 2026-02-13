"use client";

import type { UIMessage } from "ai";
import { ThreadErrorAlert } from "@/components/chat/thread-error-alert";
import { ThreadHeader } from "@/components/chat/thread-header";
import { ModelsCatalogue } from "@/components/chat/model-catalog";
import { ThreadMessages } from "@/components/chat/thread-messages";
import { getStreamingLabel } from "@/components/chat/thread-streaming-label";
import { ThreadPromptInput } from "@/components/chat/thread-user-input";
import { useThreadChat } from "@/components/chat/use-thread-chat";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

interface ThreadRouteContentProps {
  initialMessages?: UIMessage[];
  initialPrompt?: string;
  initialThreadId?: string;
  initialTitle?: string;
  initialModelSelection?: ThreadModelSelection;
}

export function ThreadRouteContent({
  initialMessages = [],
  initialPrompt,
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
    handleModelChange,
    handleThinkingBudgetChange,
    handleSubmit,
    stop,
  } = useThreadChat({
    initialMessages,
    initialModelSelection,
    initialPrompt,
    initialThreadId,
  });

  const streamingLabel = getStreamingLabel(status, messages);

  return (
    <>
      <ThreadHeader activeThreadId={activeThreadId} title={initialTitle} />

      <ThreadMessages
        messages={messages}
        status={status}
        streamingLabel={streamingLabel}
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
