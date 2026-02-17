import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";

import { aggregateContextSize } from "./usage";
import type {
  CompactThreadOptions,
  CompactThreadResult,
  ThreadMessageRecord,
  ThreadRecord,
} from "./types";

export class ThreadCompactor {
  async compactIfNeeded(
    thread: ThreadRecord,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult> {
    const shouldCompact = this.shouldCompact(thread, options.policy);

    if (!shouldCompact) {
      return {
        didCompact: false,
        thread,
      };
    }

    const now = options.now ?? new Date().toISOString();
    const summaryMessage = await options.summarizeHistory(thread.history);
    const latestOrdinal =
      thread.history.length > 0
        ? (thread.history[thread.history.length - 1]?.ordinal ?? null)
        : null;

    const summaryRecord = buildSummaryRecord(summaryMessage, now);

    const compactedThread: ThreadRecord = {
      ...thread,
      activeHistory: [summaryRecord],
      lastCompactionOrdinal: latestOrdinal,
      contextSize: aggregateContextSize(thread.history),
      updatedAt: now,
    };

    return {
      didCompact: true,
      thread: compactedThread,
    };
  }

  shouldCompact(
    thread: ThreadRecord,
    policy: { maxContextTokens: number; reservedOutputTokens?: number },
  ): boolean {
    const context = aggregateContextSize(thread.activeHistory);
    const used = context.totalInputTokens + context.totalOutputTokens;
    const reserved = policy.reservedOutputTokens ?? 0;

    return used + reserved > policy.maxContextTokens;
  }
}

function buildSummaryRecord(
  message: ModelMessage,
  now: string,
): ThreadMessageRecord {
  const normalized: ModelMessage = {
    role: "user",
    content: toUserSummaryText(message),
  };

  return {
    id: randomUUID(),
    ordinal: 1,
    version: 1,
    message: normalized,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalDurationMs: 0,
      totalCostUsd: 0,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    error: null,
  };
}

function toUserSummaryText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "Conversation summary.";
  }

  const parts: string[] = [];
  for (const part of message.content) {
    if ("text" in part && typeof part.text === "string") {
      parts.push(part.text);
      continue;
    }

    if (part.type === "tool-call") {
      parts.push(
        `Tool call ${part.toolName}: ${JSON.stringify(part.input ?? null)}`,
      );
      continue;
    }

    if (part.type === "tool-result") {
      parts.push(
        `Tool result ${part.toolName}: ${JSON.stringify(part.output)}`,
      );
    }
  }

  return parts.join("\n").trim() || "Conversation summary.";
}
