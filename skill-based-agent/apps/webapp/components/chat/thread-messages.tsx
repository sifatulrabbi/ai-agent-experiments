"use client";

import type { UIMessage } from "ai";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  MessageSquareIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [toastState, setToastState] = useState<{
    description?: string;
    title: string;
    variant: "default" | "destructive";
  } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const isBusy = status === "submitted" || status === "streaming";

  const showToast = useCallback(
    (nextToast: {
      description?: string;
      title: string;
      variant: "default" | "destructive";
    }) => {
      setToastState(nextToast);

      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = window.setTimeout(() => {
        setToastState(null);
      }, 3000);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

    const payload = {
      messageId: editingMessageId,
      modelSelection: editModelSelection ?? currentModelSelection,
      text: editValue,
    };

    cancelEdit();

    try {
      await onEditUserMessage(payload);
      showToast({
        title: "Message updated",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to save edited message", error);
      showToast({
        description: "Please try again.",
        title: "Could not save message",
        variant: "destructive",
      });
    }
  }, [
    cancelEdit,
    currentModelSelection,
    editModelSelection,
    editValue,
    editingMessageId,
    onEditUserMessage,
    showToast,
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

    const payload = {
      messageId: rerunMessageId,
      modelSelection: rerunModelSelection ?? currentModelSelection,
    };

    closeRerunDialog();

    try {
      await onRerunAssistantMessage(payload);
      showToast({
        title: "Rerun started",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to rerun assistant message", error);
      showToast({
        description: "Please try again.",
        title: "Could not rerun response",
        variant: "destructive",
      });
    }
  }, [
    closeRerunDialog,
    currentModelSelection,
    onRerunAssistantMessage,
    rerunMessageId,
    rerunModelSelection,
    showToast,
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
                          disabled={
                            isBusy || !editValue.trim() || !hasMessageId
                          }
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

      {toastState ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(360px,calc(100vw-2rem))]">
          <Alert
            className="border shadow-lg"
            variant={toastState.variant}
          >
            {toastState.variant === "destructive" ? (
              <AlertCircleIcon className="size-4" />
            ) : (
              <CheckCircle2Icon className="size-4" />
            )}
            <AlertTitle>{toastState.title}</AlertTitle>
            {toastState.description ? (
              <AlertDescription>{toastState.description}</AlertDescription>
            ) : null}
          </Alert>
        </div>
      ) : null}
    </>
  );
}
