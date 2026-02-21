"use client";

import { useCallback } from "react";
import type { UIMessage } from "ai";
import type { ModelSelection } from "@protean/model-catalog";

interface CreateThreadRequest {
  modelSelection: ModelSelection;
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
      const response = await fetch("/threads", {
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
      modelSelection: ModelSelection;
    }): Promise<void> => {
      await fetch(`/threads/${args.threadId}`, {
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
      const response = await fetch(`/threads/${threadId}`, {
        method: "DELETE",
      });

      return response.ok;
    },
    [],
  );

  const addMessage = useCallback(
    async (args: {
      threadId: string;
      message: UIMessage;
      modelSelection?: ModelSelection;
    }): Promise<void> => {
      const response = await fetch(`/threads/${args.threadId}/messages`, {
        body: JSON.stringify({
          message: args.message,
          modelSelection: args.modelSelection,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to add message");
      }
    },
    [],
  );

  const editMessage = useCallback(
    async (args: {
      threadId: string;
      messageId: string;
      message: UIMessage;
    }): Promise<void> => {
      const response = await fetch(
        `/threads/${args.threadId}/messages/${args.messageId}`,
        {
          body: JSON.stringify({ message: args.message }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Unable to edit message");
      }
    },
    [],
  );

  return {
    addMessage,
    createThread,
    deleteThread,
    editMessage,
    updateThreadModelSelection,
  };
}
