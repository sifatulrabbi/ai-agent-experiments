"use client";

import type { UIMessage } from "ai";
import { useMemo } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { ToolCallStatus } from "@/components/ai-elements/tool";
import { isThreadToolPart } from "@/components/chat/thread-ui-shared";
import { FileArtifact } from "@/components/chat/file-artifact";
import { detectFilesFromToolResult } from "@/lib/file-utils";

interface ThreadMessagePartsProps {
  isLastMessage: boolean;
  isStreaming: boolean;
  message: UIMessage;
  messageKey: string;
}

export function ThreadMessageParts({
  isLastMessage,
  isStreaming,
  message,
  messageKey,
}: ThreadMessagePartsProps) {
  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === "reasoning") {
          if (!part.text.trim()) {
            return null;
          }

          const isReasoningStreaming =
            isStreaming && isLastMessage && index === message.parts.length - 1;

          return (
            <Reasoning
              className="w-full"
              isStreaming={isReasoningStreaming}
              key={`${messageKey}-reasoning-${index}`}
            >
              <ReasoningTrigger />
              <ReasoningContent>{part.text}</ReasoningContent>
            </Reasoning>
          );
        }

        if (part.type === "text") {
          return (
            <MessageResponse
              key={`${messageKey}-${index}`}
              className="w-full text-base"
            >
              {part.text}
            </MessageResponse>
          );
        }

        if (isThreadToolPart(part)) {
          const toolKey =
            part.toolCallId?.trim() || `${messageKey}-tool-${index}`;

          const toolStatus =
            part.type === "dynamic-tool" ? (
              <ToolCallStatus
                key={toolKey}
                state={part.state}
                toolName={part.toolName}
                type={part.type}
              />
            ) : (
              <ToolCallStatus
                key={toolKey}
                state={part.state}
                type={part.type}
              />
            );

          if (part.state === "output-available") {
            const files = detectFilesFromToolResult(part.output);
            if (files && files.length > 0) {
              return (
                <div key={toolKey}>
                  {toolStatus}
                  {files.map((file) => (
                    <FileArtifact
                      key={`${toolKey}-file-${file.path}`}
                      file={file}
                    />
                  ))}
                </div>
              );
            }
          }

          return toolStatus;
        }

        return null;
      })}
    </>
  );
}
