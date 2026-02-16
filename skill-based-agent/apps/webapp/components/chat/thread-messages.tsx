"use client";

import type { UIMessage } from "ai";
import {
  CheckIcon,
  CopyIcon,
  MessageSquareIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageToolbar,
} from "@/components/ai-elements/message";
import { ThreadMessageParts } from "@/components/chat/thread-message-parts";
import {
  messageKeyFor,
  type ThreadStatus,
} from "@/components/chat/thread-ui-shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ThreadMessagesProps {
  messages: UIMessage[];
  onEditUserMessage: (payload: {
    messageId: string;
    text: string;
  }) => Promise<void>;
  onRerunAssistantMessage: (payload: { messageId: string }) => Promise<void>;
  status: ThreadStatus;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function ThreadMessages({
  messages,
  status,
  onEditUserMessage,
  onRerunAssistantMessage,
}: ThreadMessagesProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const isBusy = status === "submitted" || status === "streaming";

  const copyMessage = useCallback(async (message: UIMessage) => {
    const text = getMessageText(message);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }

    setCopiedMessageId(message.id);
    setTimeout(() => {
      setCopiedMessageId((current) =>
        current === message.id ? null : current,
      );
    }, 1500);
  }, []);

  const startEdit = useCallback((message: UIMessage) => {
    if (message.role !== "user") return;

    setEditingMessageId(message.id);
    setEditValue(getMessageText(message));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMessageId) return;

    await onEditUserMessage({
      messageId: editingMessageId,
      text: editValue,
    });
    cancelEdit();
  }, [cancelEdit, editValue, editingMessageId, onEditUserMessage]);

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent>
        {messages.length === 0 ? (
          <ConversationEmptyState
            description="Send a message to start the conversation."
            icon={<MessageSquareIcon className="size-6" />}
            title="Start a conversation"
          />
        ) : (
          messages.map((message, messageIndex) => {
            const messageKey = messageKeyFor(message, messageIndex);
            const messageText = getMessageText(message);
            const hasMessageId = message.id.trim().length > 0;

            return (
              <Message from={message.role} key={messageKey}>
                <MessageContent>
                  <ThreadMessageParts
                    isLastMessage={messageIndex === messages.length - 1}
                    isStreaming={status === "streaming"}
                    message={message}
                    messageKey={messageKey}
                  />
                </MessageContent>

                {editingMessageId === message.id ? (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      className="font-(family-name:--font-literata) text-base"
                      onChange={(event) => setEditValue(event.target.value)}
                      value={editValue}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={isBusy || !editValue.trim() || !hasMessageId}
                        onClick={() => {
                          void saveEdit();
                        }}
                        size="sm"
                        type="button"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={cancelEdit}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {editingMessageId !== message.id &&
                !isBusy &&
                (message.role === "assistant" || message.role === "user") ? (
                  <MessageToolbar
                    className={
                      message.role === "user"
                        ? "mt-0 justify-end"
                        : "mt-0 justify-start"
                    }
                  >
                    <MessageActions>
                      <MessageAction
                        disabled={!messageText}
                        label="Copy message"
                        onClick={() => {
                          void copyMessage(message);
                        }}
                        tooltip="Copy"
                      >
                        {copiedMessageId === message.id ? (
                          <CheckIcon className="size-4" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </MessageAction>

                      {message.role === "user" ? (
                        <MessageAction
                          disabled={isBusy || !hasMessageId}
                          label="Edit message"
                          onClick={() => startEdit(message)}
                          tooltip="Edit"
                        >
                          <PencilIcon className="size-4" />
                        </MessageAction>
                      ) : null}

                      {message.role === "assistant" ? (
                        <MessageAction
                          disabled={isBusy || !hasMessageId}
                          label="Rerun response"
                          onClick={() => {
                            void onRerunAssistantMessage({
                              messageId: message.id,
                            });
                          }}
                          tooltip="Rerun"
                        >
                          <RotateCcwIcon className="size-4" />
                        </MessageAction>
                      ) : null}
                    </MessageActions>
                  </MessageToolbar>
                ) : null}
              </Message>
            );
          })
        )}

      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
