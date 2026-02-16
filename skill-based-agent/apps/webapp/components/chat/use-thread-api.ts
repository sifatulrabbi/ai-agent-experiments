"use client";

import { useCallback } from "react";
import type { ThreadModelSelection } from "@/lib/server/chat-repository";

interface CreateThreadRequest {
  modelSelection: ThreadModelSelection;
  initialUserMessage?: string;
  title?: string;
}

interface CreateThreadResponse {
  thread: {
    id: string;
  };
}

export function useThreadApi() {
  const createThread = useCallback(
    async ({
      modelSelection,
      initialUserMessage,
      title,
    }: CreateThreadRequest): Promise<string> => {
      const response = await fetch("/agent/chats", {
        body: JSON.stringify({ initialUserMessage, modelSelection, title }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to create chat thread");
      }

      const data = (await response.json()) as CreateThreadResponse;
      return data.thread.id;
    },
    [],
  );

  const updateThreadModelSelection = useCallback(
    async (args: {
      threadId: string;
      modelSelection: ThreadModelSelection;
    }): Promise<void> => {
      await fetch(`/agent/chats/${args.threadId}`, {
        body: JSON.stringify({ modelSelection: args.modelSelection }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
    },
    [],
  );

  const deleteThread = useCallback(
    async (threadId: string): Promise<boolean> => {
      const response = await fetch(`/agent/chats/${threadId}`, {
        method: "DELETE",
      });

      return response.ok;
    },
    [],
  );

  return {
    createThread,
    deleteThread,
    updateThreadModelSelection,
  };
}
