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
import type { AIModelProviderEntry } from "@/components/chat/model-catalog";
import { ModelProviderDropdown } from "@/components/chat/model-provider-dropdown";
import { ThreadMessageParts } from "@/components/chat/thread-message-parts";
import {
  messageKeyFor,
  type ThreadStatus,
} from "@/components/chat/thread-ui-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ThreadMessagesProps {
  currentModelSelection: { modelId: string; providerId: string };
  messages: UIMessage[];
  onEditUserMessage: (payload: {
    messageId: string;
    modelSelection?: { modelId: string; providerId: string };
    text: string;
  }) => Promise<void>;
  onRerunAssistantMessage: (payload: {
    messageId: string;
    modelSelection?: { modelId: string; providerId: string };
  }) => Promise<void>;
  providers: AIModelProviderEntry[];
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
  currentModelSelection,
  messages,
  status,
  onEditUserMessage,
  onRerunAssistantMessage,
  providers,
}: ThreadMessagesProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editModelSelection, setEditModelSelection] = useState<{
    modelId: string;
    providerId: string;
  } | null>(null);
  const [rerunMessageId, setRerunMessageId] = useState<string | null>(null);
  const [rerunModelSelection, setRerunModelSelection] = useState<{
    modelId: string;
    providerId: string;
  } | null>(null);

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

  const startEdit = useCallback(
    (message: UIMessage) => {
      if (message.role !== "user") return;

      setEditingMessageId(message.id);
      setEditValue(getMessageText(message));
      setEditModelSelection(currentModelSelection);
    },
    [currentModelSelection],
  );

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditValue("");
    setEditModelSelection(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMessageId) return;

    await onEditUserMessage({
      messageId: editingMessageId,
      modelSelection: editModelSelection ?? currentModelSelection,
      text: editValue,
    });
    cancelEdit();
  }, [
    cancelEdit,
    currentModelSelection,
    editModelSelection,
    editValue,
    editingMessageId,
    onEditUserMessage,
  ]);

  const openRerunDialog = useCallback(
    (message: UIMessage) => {
      setRerunMessageId(message.id);
      setRerunModelSelection(currentModelSelection);
    },
    [currentModelSelection],
  );

  const closeRerunDialog = useCallback(() => {
    setRerunMessageId(null);
    setRerunModelSelection(null);
  }, []);

  const confirmRerun = useCallback(async () => {
    if (!rerunMessageId) {
      return;
    }

    await onRerunAssistantMessage({
      messageId: rerunMessageId,
      modelSelection: rerunModelSelection ?? currentModelSelection,
    });

    closeRerunDialog();
  }, [
    closeRerunDialog,
    currentModelSelection,
    onRerunAssistantMessage,
    rerunMessageId,
    rerunModelSelection,
  ]);

  return (
    <>
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

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs">
                          Model for rerun
                        </span>
                        <ModelProviderDropdown
                          disabled={isBusy}
                          onChange={setEditModelSelection}
                          providers={providers}
                          value={editModelSelection ?? currentModelSelection}
                        />
                      </div>

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
                              openRerunDialog(message);
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeRerunDialog();
          }
        }}
        open={Boolean(rerunMessageId)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rerun with model</DialogTitle>
            <DialogDescription>
              This updates the thread default model and reruns the response.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Model</span>
            <ModelProviderDropdown
              disabled={isBusy}
              onChange={setRerunModelSelection}
              providers={providers}
              value={rerunModelSelection ?? currentModelSelection}
            />
          </div>

          <DialogFooter>
            <Button onClick={closeRerunDialog} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={isBusy || !rerunMessageId}
              onClick={() => {
                void confirmRerun();
              }}
              type="button"
            >
              Rerun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
