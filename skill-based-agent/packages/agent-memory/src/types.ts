import type { UIMessage } from "ai";

/** Accumulated token counts and cost for a single message or an entire thread. */
export interface ThreadUsage {
  inputTokens: number;
  outputTokens: number;
  totalDurationMs: number;
  totalCostUsd: number;
}

/**
 * Snapshot of the active context window size.
 * Tracks only the tokens that are currently visible to the model
 * (i.e. from `activeHistory`, not the full `history`).
 */
export interface ContextSize {
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * A single persisted message within a thread.
 *
 * - `ordinal` is a monotonically increasing integer assigned at insert time
 *   and used to reconstruct ordering after compaction.
 * - `version` is incremented when the record itself is mutated in place.
 * - `deletedAt` enables soft-deletion: the record stays on disk but is
 *   excluded from `activeHistory` and context-size calculations.
 */
export interface ThreadMessageRecord {
  id: string;
  ordinal: number;
  version: number;
  message: UIMessage;
  usage: ThreadUsage;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  error: string | null;
}

/**
 * The root object written to each `.threads/thread.<id>.json` file.
 *
 * - `history`        — immutable append-only log of every message ever saved.
 * - `activeHistory`  — subset of `history` used as the model's context window;
 *                      rebuilt after compaction or soft-deletion.
 * - `lastCompactionOrdinal` — ordinal of the last message that was replaced
 *                             by a compaction summary, or `null` if never compacted.
 * - `schemaVersion` / `contentSchemaVersion` — bumped when the file format or
 *   the message content format changes, enabling forward-compatible migrations.
 */
export interface ThreadRecord {
  schemaVersion: number;
  contentSchemaVersion: number;
  id: string;
  userId: string;
  title: string;
  modelSelection: ThreadModelSelection;
  history: ThreadMessageRecord[];
  activeHistory: ThreadMessageRecord[];
  lastCompactionOrdinal: number | null;
  contextSize: ContextSize;
  usage: ThreadUsage;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Persisted model/provider selection per thread. */
export interface ThreadModelSelection {
  providerId: string;
  modelId: string;
  reasoningBudget: string;
}

/** Pluggable cost estimator injected at `createFsMemory` time. */
export interface ThreadPricingCalculator {
  calculateCost(args: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
  }): number;
}

/** Options for `createThread`. All fields are optional; sensible defaults are applied. */
export interface CreateThreadParams {
  /** Provide a deterministic id instead of a random UUID. */
  id?: string;
  userId: string;
  title?: string;
  modelSelection: ThreadModelSelection;
  /** Override the creation timestamp (ISO-8601). Useful in tests. */
  createdAt?: string;
}

export interface UpdateThreadSettingsParams {
  title?: string;
  modelSelection?: ThreadModelSelection | null;
  now?: string;
}

export interface ReplaceThreadMessagesParams {
  messages: UIMessage[];
  now?: string;
}

/** Payload required to append a new message to an existing thread. */
export interface SaveThreadMessageParams {
  /** Provide a deterministic message id instead of a random UUID. */
  id?: string;
  /** Persisted verbatim as a UI-layer message; convert to model messages at call time. */
  message: UIMessage;
  /** Used by the pricing calculator and to track what model was used for the message. */
  modelSelection: ThreadModelSelection;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalDurationMs: number;
    /** If omitted, cost is calculated via `ThreadPricingCalculator` (or 0 if none). */
    totalCostUsd?: number;
  };
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Defines when the compactor should trigger.
 * Compaction replaces the full `activeHistory` with a single summary message
 * once the token budget would be exceeded.
 */
export interface CompactionPolicy {
  /** Hard limit on combined input + output tokens in the active context. */
  maxContextTokens: number;
  /**
   * Tokens to reserve for the model's next response.
   * Compaction triggers when `used + reservedOutputTokens > maxContextTokens`.
   */
  reservedOutputTokens?: number;
}

/** Options passed to `FsMemory.compactIfNeeded`. */
export interface CompactThreadOptions {
  policy: CompactionPolicy;
  /**
   * Caller-supplied function that distils the full message history into a
   * single summary `UIMessage`. The compactor replaces `activeHistory`
   * with a synthetic record built from this message.
   */
  summarizeHistory: (history: ThreadMessageRecord[]) => Promise<UIMessage>;
  /** Override the current timestamp (ISO-8601). Useful in tests. */
  now?: string;
}

/** Returned by `FsMemory.compactIfNeeded` to indicate what happened. */
export interface CompactThreadResult {
  /** `true` if the policy threshold was crossed and a compaction occurred. */
  didCompact: boolean;
  thread: ThreadRecord;
}

/**
 * Public interface for the filesystem-backed agent memory store.
 * All mutating methods serialise through an internal write queue to
 * prevent concurrent writes from corrupting thread files.
 */
export interface FsMemory {
  createThread(params: CreateThreadParams): Promise<ThreadRecord>;
  getThread(threadId: string): Promise<ThreadRecord | null>;
  listThreads(params?: {
    includeDeleted?: boolean;
    userId?: string;
  }): Promise<ThreadRecord[]>;
  saveMessage(
    threadId: string,
    payload: SaveThreadMessageParams,
  ): Promise<ThreadRecord | null>;
  replaceMessages(
    threadId: string,
    params: ReplaceThreadMessagesParams,
  ): Promise<ThreadRecord | null>;
  softDeleteThread(
    threadId: string,
    options?: { deletedAt?: string },
  ): Promise<boolean>;
  /** Recomputes `activeHistory` from the full `history`, discarding any soft-deleted messages. */
  rebuildActiveHistory(
    threadId: string,
    options?: { now?: string },
  ): Promise<ThreadRecord | null>;
  compactIfNeeded(
    threadId: string,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult | null>;
  updateThreadSettings(
    threadId: string,
    params: UpdateThreadSettingsParams,
  ): Promise<ThreadRecord | null>;
  /** Recomputes cumulative usage totals from the full history. */
  updateThreadUsage(threadId: string): Promise<ThreadRecord | null>;
  /** Recomputes the active context-window token counts. */
  updateContextSize(threadId: string): Promise<ThreadRecord | null>;
}
