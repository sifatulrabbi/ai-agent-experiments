"use client";

import { createContext, use, type ReactNode } from "react";
import type { UIMessage } from "ai";
import type {
  ModelSelection,
  AIModelProviderEntry,
} from "@protean/model-catalog";
import type { ThreadUsage } from "@protean/agent-memory";
import { useThreadChat, type UseThreadChatResult } from "./use-thread-chat";

interface ThreadChatContextValue extends UseThreadChatResult {
  messageUsageMap: Record<string, ThreadUsage>;
}

const ThreadChatContext = createContext<ThreadChatContextValue | null>(null);

interface ThreadChatProviderProps {
  children: ReactNode;
  defaultModelSelection: ModelSelection;
  initialMessageUsageMap?: Record<string, ThreadUsage>;
  initialMessages?: UIMessage[];
  initialModelSelection?: ModelSelection;
  initialThreadId?: string;
  providers: AIModelProviderEntry[];
}

export function ThreadChatProvider({
  children,
  defaultModelSelection,
  initialMessageUsageMap = {},
  initialMessages = [],
  initialModelSelection,
  initialThreadId,
  providers,
}: ThreadChatProviderProps) {
  const chat = useThreadChat({
    defaultModelSelection,
    initialMessages,
    initialModelSelection,
    initialThreadId,
    providers,
  });

  return (
    <ThreadChatContext
      value={{ ...chat, messageUsageMap: initialMessageUsageMap }}
    >
      {children}
    </ThreadChatContext>
  );
}

export function useThreadChatContext(): ThreadChatContextValue {
  const ctx = use(ThreadChatContext);
  if (!ctx) {
    throw new Error(
      "useThreadChatContext must be used within ThreadChatProvider",
    );
  }
  return ctx;
}
