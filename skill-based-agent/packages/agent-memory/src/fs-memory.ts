import { randomUUID } from "node:crypto";
import { modelMessageSchema } from "ai";
import { z } from "zod";
import type { FileEntry, FS } from "@protean/vfs";

import { createHistoryCompactor } from "./compaction";
import { ThreadMemoryError } from "./errors";
import type {
  CompactThreadOptions,
  CompactThreadResult,
  CreateThreadParams,
  SaveThreadMessageParams,
  ThreadMessageRecord,
  ThreadPricingCalculator,
  ThreadRecord,
  FsMemory,
} from "./types";
import {
  aggregateContextSize,
  aggregateThreadUsage,
  emptyContextSize,
  emptyUsage,
  resolveMessageCost,
} from "./usage";

/** Bumped when the shape of `ThreadRecord` itself changes in a breaking way. */
const THREAD_SCHEMA_VERSION = 1;
/** Bumped when the shape of the stored `ModelMessage` content changes. */
const CONTENT_SCHEMA_VERSION = 1;

const threadUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalDurationMs: z.number(),
  totalCostUsd: z.number(),
});

const threadMessageRecordSchema = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  version: z.number().int().min(1),
  message: modelMessageSchema,
  usage: threadUsageSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  error: z.string().nullable(),
});

const contextSizeSchema = z.object({
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
});

const threadRecordSchema: z.ZodType<ThreadRecord> = z.object({
  schemaVersion: z.literal(THREAD_SCHEMA_VERSION),
  contentSchemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  id: z.string(),
  history: z.array(threadMessageRecordSchema),
  activeHistory: z.array(threadMessageRecordSchema),
  lastCompactionOrdinal: z.number().int().min(1).nullable(),
  contextSize: contextSizeSchema,
  usage: threadUsageSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export interface FsMemoryOptions {
  /** Virtual (or real) filesystem adapter used for all I/O. */
  fs: FS;
  /**
   * Directory where thread `.jsonc` files are stored.
   * @default ".threads"
   */
  dirPath?: string;
  /** Optional cost calculator injected for per-message USD estimates. */
  pricingCalculator?: ThreadPricingCalculator;
}

/**
 * Creates an {@link FsMemory} backed by any `FS`-compatible filesystem.
 *
 * Each thread is stored as a single `.jsonc` file named
 * `thread.<id>.jsonc` inside `dirPath`. All mutating operations are
 * serialised through an in-process write queue (`withLock`) to prevent
 * concurrent writes from producing corrupt files.
 */
export function createFsMemory(options: FsMemoryOptions): FsMemory {
  const fs = options.fs;
  const pricingCalculator = options.pricingCalculator;
  const rootDir = options.dirPath || ".threads";
  const compactor = createHistoryCompactor();
  // Single-entry async queue that serialises all write operations.
  let writeQueue: Promise<void> = Promise.resolve();

  /**
   * Recomputes `usage` and `contextSize` from the thread's full `history`.
   * Called after every mutation so the persisted file always has fresh totals.
   */
  function recalculateUsageAndContext(thread: ThreadRecord): ThreadRecord {
    return {
      ...thread,
      usage: aggregateThreadUsage(thread.history),
      contextSize: aggregateContextSize(thread.history),
    };
  }

  /**
   * Throws `INVALID_STATE` if `threadId` contains characters outside
   * `[A-Za-z0-9_-]`. This prevents path-traversal attacks and ensures
   * the id maps cleanly to a filename.
   */
  function ensureThreadId(threadId: string): void {
    const valid = /^[A-Za-z0-9_-]+$/.test(threadId);
    if (!valid) {
      throw new ThreadMemoryError(
        "INVALID_STATE",
        `Invalid thread id: ${threadId}`,
      );
    }
  }

  /** Returns the absolute path for a given thread id, e.g. `.threads/thread.abc123.jsonc`. */
  function threadFilePath(threadId: string): string {
    ensureThreadId(threadId);
    const fileName = `thread.${threadId}.jsonc`;
    return `${rootDir}/${fileName}`;
  }

  /** Returns `true` if a filename matches the expected `thread.<id>.jsonc` pattern. */
  function isThreadFile(name: string): boolean {
    return /^thread\.[A-Za-z0-9_-]+\.jsonc$/.test(name);
  }

  /**
   * Runs `task` exclusively, ensuring no other write can interleave.
   *
   * Works by chaining each new task onto the tail of `writeQueue`.
   * The `release` callback advances the queue to the next waiting task.
   */
  async function withLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = writeQueue;
    let release: () => void = () => {};

    writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }

  /**
   * Waits until the current write queue drains before performing a read.
   * This guarantees that reads always see the result of the most recent write.
   */
  async function waitForPendingWrites(): Promise<void> {
    await writeQueue;
  }

  /**
   * Reads and validates a thread file from `filePath`.
   *
   * Throws `ENOENT` errors as-is (callers decide whether that means "not found"
   * or "unexpected"), and maps other failures to typed {@link ThreadMemoryError}s.
   */
  async function readThreadFile(filePath: string): Promise<ThreadRecord> {
    try {
      const raw = await fs.readFile(filePath);
      const parsed = JSON.parse(raw) as unknown;
      const result = threadRecordSchema.safeParse(parsed);

      if (!result.success) {
        throw new ThreadMemoryError(
          "VALIDATION_ERROR",
          `Invalid persisted thread state: ${result.error.message}`,
          result.error,
        );
      }

      return result.data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw error;
      }

      if (error instanceof ThreadMemoryError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new ThreadMemoryError(
          "VALIDATION_ERROR",
          "Persisted thread state is not valid JSON.",
          error,
        );
      }

      throw new ThreadMemoryError(
        "READ_ERROR",
        `Failed to read persisted thread state from ${filePath}.`,
        error,
      );
    }
  }

  /**
   * Reads a thread by id; returns `null` if the file does not exist.
   * Re-throws any other error (e.g. permission denied, parse failure).
   */
  async function readThread(threadId: string): Promise<ThreadRecord | null> {
    const filePath = threadFilePath(threadId);

    try {
      return await readThreadFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  /**
   * Validates then writes a thread to disk using an atomic-ish two-step:
   * 1. Write to a uniquely named `.tmp` file.
   * 2. Overwrite the canonical file with the same content.
   * 3. Remove the `.tmp` file.
   *
   * This minimises (but does not eliminate) the window during which a crash
   * could leave the canonical file in a corrupted state.
   */
  async function writeThread(thread: ThreadRecord): Promise<void> {
    const validated = threadRecordSchema.safeParse(thread);
    if (!validated.success) {
      throw new ThreadMemoryError(
        "VALIDATION_ERROR",
        `Refusing to write invalid state: ${validated.error.message}`,
        validated.error,
      );
    }

    const filePath = threadFilePath(thread.id);
    const tempPath = `${filePath}.${randomUUID()}.tmp`;
    const payload = JSON.stringify(validated.data, null, 2);

    try {
      await fs.writeFile(tempPath, payload);
      await fs.writeFile(filePath, payload);
      await fs.remove(tempPath);
    } catch (error) {
      throw new ThreadMemoryError(
        "WRITE_ERROR",
        `Failed to write persisted thread state for ${thread.id}.`,
        error,
      );
    }
  }

  /**
   * Creates a new empty thread and persists it to disk.
   * Throws `INVALID_STATE` if a thread with the same id already exists.
   */
  async function createThread(
    params?: CreateThreadParams,
  ): Promise<ThreadRecord> {
    const now = params?.createdAt ?? new Date().toISOString();
    const threadId = params?.id ?? randomUUID();
    ensureThreadId(threadId);

    const thread: ThreadRecord = {
      schemaVersion: THREAD_SCHEMA_VERSION,
      contentSchemaVersion: CONTENT_SCHEMA_VERSION,
      id: threadId,
      history: [],
      activeHistory: [],
      lastCompactionOrdinal: null,
      contextSize: emptyContextSize(),
      usage: emptyUsage(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    return withLock(async () => {
      const existing = await readThread(thread.id);
      if (existing) {
        throw new ThreadMemoryError(
          "INVALID_STATE",
          `Thread already exists: ${thread.id}`,
        );
      }

      await writeThread(thread);
      return thread;
    });
  }

  /**
   * Returns the thread with `threadId`, or `null` if it does not exist.
   * Waits for any in-flight writes to complete before reading.
   */
  async function getThread(threadId: string): Promise<ThreadRecord | null> {
    await waitForPendingWrites();
    return readThread(threadId);
  }

  /**
   * Returns all threads in `rootDir`, sorted by `updatedAt` descending.
   *
   * - If the directory does not exist, returns an empty array instead of throwing.
   * - Soft-deleted threads are excluded by default; pass `{ includeDeleted: true }`
   *   to include them.
   */
  async function listThreads(params?: {
    includeDeleted?: boolean;
  }): Promise<ThreadRecord[]> {
    await waitForPendingWrites();

    let entries: FileEntry[];
    try {
      entries = await fs.readdir(rootDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw new ThreadMemoryError(
        "READ_ERROR",
        `Failed to list thread files in ${rootDir}.`,
        error,
      );
    }

    const includeDeleted = params?.includeDeleted ?? false;
    const threadFiles = entries
      .filter((entry) => !entry.isDirectory && isThreadFile(entry.name))
      .map((entry) => `${rootDir}/${entry.name}`);

    const threads = await Promise.all(
      threadFiles.map((path) => readThreadFile(path)),
    );

    return threads
      .filter((thread) => includeDeleted || thread.deletedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Appends a new message record to both `history` and `activeHistory`,
   * then recalculates usage and context-size totals.
   *
   * The `ordinal` for the new record is derived from the last entry in
   * `history` + 1, ensuring it is always strictly increasing.
   *
   * Returns `null` if the thread does not exist.
   */
  async function saveMessage(
    threadId: string,
    payload: SaveThreadMessageParams,
  ): Promise<ThreadRecord | null> {
    const now = payload.updatedAt ?? new Date().toISOString();

    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return null;
      }

      const nextOrdinal =
        thread.history.length > 0
          ? (thread.history[thread.history.length - 1]?.ordinal ?? 0) + 1
          : 1;

      const usage = {
        inputTokens: payload.usage.inputTokens,
        outputTokens: payload.usage.outputTokens,
        totalDurationMs: payload.usage.totalDurationMs,
        totalCostUsd: resolveMessageCost({
          inputTokens: payload.usage.inputTokens,
          outputTokens: payload.usage.outputTokens,
          explicitCostUsd: payload.usage.totalCostUsd,
          modelId: payload.modelId,
          pricingCalculator,
        }),
      };

      const messageRecord: ThreadMessageRecord = {
        id: payload.id ?? randomUUID(),
        ordinal: nextOrdinal,
        version: 1,
        message: payload.message,
        usage,
        createdAt: payload.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        error: payload.error ?? null,
      };

      const updatedThread: ThreadRecord = {
        ...thread,
        history: [...thread.history, messageRecord],
        activeHistory: [...thread.activeHistory, messageRecord],
        updatedAt: now,
      };

      const withUsageAndContext = recalculateUsageAndContext(updatedThread);
      await writeThread(withUsageAndContext);

      return withUsageAndContext;
    });
  }

  /**
   * Marks a thread as deleted without removing it from disk.
   *
   * - Returns `false` if the thread does not exist.
   * - Returns `true` (idempotent) if the thread was already soft-deleted.
   */
  async function softDeleteThread(
    threadId: string,
    options?: { deletedAt?: string },
  ): Promise<boolean> {
    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return false;
      }

      // Already deleted — treat as a no-op and report success.
      if (thread.deletedAt !== null) {
        return true;
      }

      const updated: ThreadRecord = {
        ...thread,
        deletedAt: options?.deletedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await writeThread(updated);
      return true;
    });
  }

  /**
   * Recomputes `activeHistory` by filtering out all soft-deleted messages
   * from the full `history`, then resets `lastCompactionOrdinal` to `null`.
   *
   * Use this to "restore" a thread to its full history after an incorrect
   * compaction, or after manually soft-deleting specific messages.
   */
  async function rebuildActiveHistory(
    threadId: string,
    options?: { now?: string },
  ): Promise<ThreadRecord | null> {
    const now = options?.now ?? new Date().toISOString();

    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return null;
      }

      const activeHistory = thread.history.filter(
        (message) => message.deletedAt === null,
      );

      const updatedThread: ThreadRecord = {
        ...thread,
        activeHistory,
        lastCompactionOrdinal: null,
        updatedAt: now,
      };

      const withUsageAndContext = recalculateUsageAndContext(updatedThread);
      await writeThread(withUsageAndContext);

      return withUsageAndContext;
    });
  }

  /**
   * Delegates to {@link HistoryCompactor.compactIfNeeded} and persists the
   * result only when an actual compaction occurred (`didCompact: true`).
   *
   * Returns `null` if the thread does not exist.
   */
  async function compactIfNeeded(
    threadId: string,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult | null> {
    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return null;
      }

      const compacted = await compactor.compactIfNeeded(thread, options);
      const nextThread = recalculateUsageAndContext(compacted.thread);

      if (compacted.didCompact) {
        await writeThread(nextThread);
      }

      return {
        didCompact: compacted.didCompact,
        thread: nextThread,
      };
    });
  }

  /**
   * Recalculates and persists the cumulative `usage` totals from the full
   * `history`. Useful when usage data becomes out-of-sync (e.g. after a
   * manual data repair).
   */
  async function updateThreadUsage(
    threadId: string,
  ): Promise<ThreadRecord | null> {
    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return null;
      }

      const updatedThread: ThreadRecord = {
        ...thread,
        usage: aggregateThreadUsage(thread.history),
        updatedAt: new Date().toISOString(),
      };

      await writeThread(updatedThread);
      return updatedThread;
    });
  }

  /**
   * Recalculates and persists `contextSize` from the full `history`.
   * Useful for the same repair scenarios as {@link updateThreadUsage}.
   */
  async function updateContextSize(
    threadId: string,
  ): Promise<ThreadRecord | null> {
    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return null;
      }

      const updatedThread: ThreadRecord = {
        ...thread,
        contextSize: aggregateContextSize(thread.history),
        updatedAt: new Date().toISOString(),
      };

      await writeThread(updatedThread);
      return updatedThread;
    });
  }

  return {
    createThread,
    getThread,
    listThreads,
    saveMessage,
    softDeleteThread,
    rebuildActiveHistory,
    compactIfNeeded,
    updateThreadUsage,
    updateContextSize,
  };
}
