"use client";

import { useThreadChatContext } from "@/components/chat/thread-chat-provider";

export function ThreadHeader() {
  const { activeThreadId: _ } = useThreadChatContext();
  return null;
}
