"use client";

import type { UIMessage } from "ai";
import type { ModelSelection } from "@protean/model-catalog";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  BrainIcon,
  MessageSquareIcon,
  PencilIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getModelById } from "@protean/model-catalog";
import { useModelCatalog } from "@/components/chat/model-catalog-provider";
import { ModelSelectorDropdown } from "@/components/chat/model-selector-dropdown";
import { useThreadChatContext } from "@/components/chat/thread-chat-provider";
import { ThreadMessageParts } from "@/components/chat/thread-message-parts";
import { messageKeyFor } from "@/components/chat/thread-ui-shared";
import { cn, formatCostUsd, formatTokenCount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function ThreadMessagesLoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
      <Spinner className="size-5 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium text-sm">Preparing your conversation</p>
        <p className="text-muted-foreground text-xs">
          Creating thread and starting your request...
        </p>
      </div>
    </div>
  );
}

export function ThreadMessages() {
  const {
    handleEditUserMessage,
    handleRerunAssistantMessage,
    messageUsageMap,
    messages,
    modelSelection: currentModelSelection,
    status,
  } = useThreadChatContext();
  const providers = useModelCatalog();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editModelSelection, setEditModelSelection] =
    useState<ModelSelection | null>(null);
  const [editReasoningBudget, setEditReasoningBudget] = useState<string | null>(
    null,
  );
  const [rerunMessageId, setRerunMessageId] = useState<string | null>(null);
  const [rerunModelSelection, setRerunModelSelection] =
    useState<ModelSelection | null>(null);
  const [toastState, setToastState] = useState<{
    description?: string;
    title: string;
    variant: "default" | "destructive";
  } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const isBusy = status === "submitted" || status === "streaming";
  const effectiveEditModelSelection =
    editModelSelection ?? currentModelSelection;
  const selectedEditModel = useMemo(
    () =>
      getModelById(
        providers,
        effectiveEditModelSelection.providerId,
        effectiveEditModelSelection.modelId,
      ),
    [
      effectiveEditModelSelection.modelId,
      effectiveEditModelSelection.providerId,
      providers,
    ],
  );
  const availableEditReasoningBudgets = useMemo(
    () => selectedEditModel?.reasoning.budgets ?? [],
    [selectedEditModel],
  );
  const supportsEditThinking = availableEditReasoningBudgets.some(
    (budget) => budget !== "none",
  );
  const activeEditReasoningBudget = useMemo(() => {
    const defaultValue = selectedEditModel?.reasoning.defaultValue ?? "none";
    if (!editReasoningBudget) return defaultValue;
    if (!selectedEditModel?.reasoning.budgets.includes(editReasoningBudget))
      return defaultValue;
    return editReasoningBudget;
  }, [editReasoningBudget, selectedEditModel]);

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
      setEditReasoningBudget(currentModelSelection.reasoningBudget);
    },
    [currentModelSelection],
  );

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditValue("");
    setEditModelSelection(null);
    setEditReasoningBudget(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingMessageId) return;

    const base = editModelSelection ?? currentModelSelection;
    const payload = {
      messageId: editingMessageId,
      modelSelection: {
        ...base,
        reasoningBudget: (editReasoningBudget ??
          selectedEditModel?.reasoning.defaultValue ??
          base.reasoningBudget) as ModelSelection["reasoningBudget"],
      },
      text: editValue,
    };

    cancelEdit();

    try {
      await handleEditUserMessage(payload);
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
    editReasoningBudget,
    editValue,
    editingMessageId,
    selectedEditModel?.reasoning.defaultValue,
    handleEditUserMessage,
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

    const payload: {
      messageId: string;
      modelSelection?: ModelSelection;
    } = {
      messageId: rerunMessageId,
      modelSelection: rerunModelSelection ?? currentModelSelection,
    };

    closeRerunDialog();

    try {
      await handleRerunAssistantMessage(payload);
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
    handleRerunAssistantMessage,
    rerunMessageId,
    rerunModelSelection,
    showToast,
  ]);

  return (
    <>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            status === "submitted" ? (
              <ThreadMessagesLoadingState />
            ) : (
              <ConversationEmptyState
                description="Send a message to start the conversation."
                icon={<MessageSquareIcon className="size-6" />}
                title="Start a conversation"
              />
            )
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
                        <div className="flex items-center gap-2">
                          <ModelSelectorDropdown
                            disabled={isBusy}
                            onChange={setEditModelSelection}
                            value={editModelSelection ?? currentModelSelection}
                          />
                          {supportsEditThinking ? (
                            <>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    className="h-8 w-8 px-0 sm:hidden"
                                    disabled={isBusy}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <BrainIcon className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {availableEditReasoningBudgets.map(
                                    (budget) => (
                                      <DropdownMenuItem
                                        className="flex items-center justify-between gap-2"
                                        key={budget}
                                        onSelect={() =>
                                          setEditReasoningBudget(budget)
                                        }
                                      >
                                        <span>
                                          {budget === "none"
                                            ? "None"
                                            : `${budget[0]?.toUpperCase()}${budget.slice(1)}`}
                                        </span>
                                        {budget ===
                                        activeEditReasoningBudget ? (
                                          <CheckIcon className="size-4 text-muted-foreground" />
                                        ) : null}
                                      </DropdownMenuItem>
                                    ),
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Select
                                onValueChange={(value) =>
                                  setEditReasoningBudget(value)
                                }
                                value={activeEditReasoningBudget}
                              >
                                <SelectTrigger
                                  className="hidden h-8 w-30 gap-2 text-xs sm:flex"
                                  size="sm"
                                >
                                  <BrainIcon className="size-3.5" />
                                  <SelectValue placeholder="Thinking" />
                                </SelectTrigger>
                                <SelectContent align="start">
                                  {availableEditReasoningBudgets.map(
                                    (budget) => (
                                      <SelectItem key={budget} value={budget}>
                                        {budget === "none"
                                          ? "None"
                                          : `${budget[0]?.toUpperCase()}${budget.slice(1)}`}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          ) : null}
                        </div>
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
                        message.role === "user" ? "mt-0 justify-end" : "mt-0"
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

                      {(() => {
                        const usage = messageUsageMap[message.id];
                        if (!usage || message.role !== "assistant") {
                          return null;
                        }
                        const cost = formatCostUsd(usage.totalCostUsd);
                        return (
                          <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                            <span>
                              {formatTokenCount(usage.inputTokens)} in
                            </span>
                            <span>·</span>
                            <span>
                              {formatTokenCount(usage.outputTokens)} out
                            </span>
                            {cost ? (
                              <>
                                <span>·</span>
                                <span>{cost}</span>
                              </>
                            ) : null}
                          </div>
                        );
                      })()}
                    </MessageToolbar>
                  ) : null}
                </Message>
              );
            })
          )}
          {messages.length > 0 ? (
            <div className="flex justify-start">
              <SparklesIcon
                className={cn(
                  "size-4 transition-colors duration-700",
                  isBusy ? "animate-spark-cycle" : "text-muted-foreground/50",
                )}
              />
            </div>
          ) : null}
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
            <ModelSelectorDropdown
              disabled={isBusy}
              onChange={setRerunModelSelection}
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
          <Alert className="border shadow-lg" variant={toastState.variant}>
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
