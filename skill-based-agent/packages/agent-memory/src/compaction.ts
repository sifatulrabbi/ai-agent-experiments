import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";

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
 *    single summary `UIMessage` from the full history.
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
    policy: CompactThreadOptions["policy"],
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
 * Wraps a summary `UIMessage` in a `ThreadMessageRecord` suitable for
 * insertion into `activeHistory`.
 *
 * The record is always assigned `ordinal: 1` because it becomes the first
 * (and only) entry in a freshly compacted `activeHistory`.
 * Usage fields are zeroed out — the summary message itself doesn't
 * represent a real model call.
 */
function buildSummaryRecord(
  message: UIMessage,
  now: string,
): ThreadMessageRecord {
  // Normalise to a plain user message with text-only parts regardless of what
  // the summariser returned so callers can deterministically convert later.
  const normalized: UIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: toUserSummaryText(message) }],
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
 * Extracts a plain string from a `UIMessage` so it can be stored as the
 * content of a `user`-role summary record.
 *
 * Text parts are concatenated with newlines. Non-text parts are preserved as
 * JSON snippets to avoid silently dropping potentially relevant context.
 */
function toUserSummaryText(message: UIMessage): string {
  const parts: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && typeof part.text === "string") {
      parts.push(part.text);
      continue;
    }

    parts.push(JSON.stringify(part));
  }

  return parts.join("\n").trim() || "Conversation summary.";
}
