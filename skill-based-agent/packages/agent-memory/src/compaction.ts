import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";

import { aggregateContextSize } from "./usage";
import type {
  CompactThreadOptions,
  CompactThreadResult,
  ThreadMessageRecord,
  ThreadRecord,
} from "./types";

/**
 * Internal service that decides whether a thread needs compaction and
 * performs it when required.
 *
 * Compaction works by:
 * 1. Calling the caller-supplied `summarizeHistory` function to produce a
 *    single summary `ModelMessage` from the full history.
 * 2. Replacing `activeHistory` with a single synthetic record built from
 *    that summary, effectively resetting the context-window token count.
 * 3. Recording `lastCompactionOrdinal` so callers know how far back the
 *    last compaction reached.
 *
 * The full `history` is never mutated — old messages remain on disk for
 * auditing and debugging.
 */
export interface HistoryCompactor {
  compactIfNeeded(
    thread: ThreadRecord,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult>;
  shouldCompact(
    thread: ThreadRecord,
    policy: { maxContextTokens: number; reservedOutputTokens?: number },
  ): boolean;
}

/**
 * Factory that creates a {@link HistoryCompactor} instance.
 * Keeping this as a factory (rather than a class) makes it easy to inject
 * dependencies or swap the implementation in tests.
 */
export function createHistoryCompactor(): HistoryCompactor {
  /**
   * Returns `true` when the combined token count of the active context window
   * plus the reserved output budget exceeds `maxContextTokens`.
   */
  function shouldCompact(
    thread: ThreadRecord,
    policy: { maxContextTokens: number; reservedOutputTokens?: number },
  ): boolean {
    const context = aggregateContextSize(thread.activeHistory);
    const used = context.totalInputTokens + context.totalOutputTokens;
    const reserved = policy.reservedOutputTokens ?? 0;

    return used + reserved > policy.maxContextTokens;
  }

  /**
   * Runs compaction if the policy threshold is crossed; otherwise returns the
   * thread unchanged with `didCompact: false`.
   *
   * When compaction occurs:
   * - The full `history` is passed to `options.summarizeHistory` to generate
   *   a summary message.
   * - `activeHistory` is replaced with a single synthetic record wrapping
   *   the summary.
   * - `lastCompactionOrdinal` is set to the ordinal of the most recent
   *   message in `history`.
   */
  async function compactIfNeeded(
    thread: ThreadRecord,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult> {
    const needsCompaction = shouldCompact(thread, options.policy);

    if (!needsCompaction) {
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

  return {
    compactIfNeeded,
    shouldCompact,
  };
}

/**
 * Wraps a summary `ModelMessage` in a `ThreadMessageRecord` suitable for
 * insertion into `activeHistory`.
 *
 * The record is always assigned `ordinal: 1` because it becomes the first
 * (and only) entry in a freshly compacted `activeHistory`.
 * Usage fields are zeroed out — the summary message itself doesn't
 * represent a real model call.
 */
function buildSummaryRecord(
  message: ModelMessage,
  now: string,
): ThreadMessageRecord {
  // Normalise to a plain user message with text content so the model can
  // interpret it regardless of what the summariser returned.
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

/**
 * Extracts a plain string from a `ModelMessage` so it can be stored as the
 * content of a `user`-role summary record.
 *
 * Handles three content shapes:
 * - Plain string — returned as-is.
 * - Array of content parts — text parts are concatenated; tool-call and
 *   tool-result parts are serialised to a human-readable form.
 * - Anything else (e.g. object) — falls back to the generic placeholder.
 */
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
