"use client";

import type { UIMessage } from "ai";
import type {
  ModelSelection,
  AIModelProviderEntry,
} from "@protean/model-catalog";
import type { ThreadUsage } from "@protean/agent-memory";
import { ModelCatalogProvider } from "@/components/chat/model-catalog-provider";
import { ThreadChatProvider } from "@/components/chat/thread-chat-provider";
import { ThreadErrorAlert } from "@/components/chat/thread-error-alert";
import { ThreadHeader } from "@/components/chat/thread-header";
import { ThreadMessages } from "@/components/chat/thread-messages";
import { ThreadPromptInput } from "@/components/chat/thread-user-input";

interface ThreadRouteContentProps {
  defaultModelSelection: ModelSelection;
  initialMessageUsageMap?: Record<string, ThreadUsage>;
  initialMessages?: UIMessage[];
  initialThreadId?: string;
  initialModelSelection?: ModelSelection;
  providers: AIModelProviderEntry[];
}

export function ThreadRouteContent({
  defaultModelSelection,
  initialMessageUsageMap,
  initialMessages,
  initialThreadId,
  initialModelSelection,
  providers,
}: ThreadRouteContentProps) {
  return (
    <ModelCatalogProvider providers={providers}>
      <ThreadChatProvider
        defaultModelSelection={defaultModelSelection}
        initialMessageUsageMap={initialMessageUsageMap}
        initialMessages={initialMessages}
        initialModelSelection={initialModelSelection}
        initialThreadId={initialThreadId}
        providers={providers}
      >
        <ThreadHeader />
        <ThreadMessages />
        <ThreadErrorAlert />
        <ThreadPromptInput />
      </ThreadChatProvider>
    </ModelCatalogProvider>
  );
}
