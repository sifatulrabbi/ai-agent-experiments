"use client";

import { useThreadChatContext } from "@/components/chat/thread-chat-provider";

export function ThreadErrorAlert() {
  const { error } = useThreadChatContext();

  if (!error) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
      {error.message}
    </div>
  );
}
