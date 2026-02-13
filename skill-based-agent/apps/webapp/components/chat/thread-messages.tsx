"use client";

import type { UIMessage } from "ai";
import { MessageSquareIcon, SparklesIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ThreadMessageParts } from "@/components/chat/thread-message-parts";
import {
  messageKeyFor,
  type ThreadStatus,
} from "@/components/chat/thread-ui-shared";

interface ThreadMessagesProps {
  messages: UIMessage[];
  status: ThreadStatus;
  streamingLabel: string | null;
}

export function ThreadMessages({
  messages,
  status,
  streamingLabel,
}: ThreadMessagesProps) {
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
              </Message>
            );
          })
        )}

        {streamingLabel ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <SparklesIcon className="size-4" />
            <Shimmer>{streamingLabel}</Shimmer>
          </div>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
