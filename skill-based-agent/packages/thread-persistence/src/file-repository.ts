import { randomUUID } from "node:crypto";
import { modelMessageSchema } from "ai";
import { z } from "zod";
import type { FileEntry, FS } from "@protean/vfs";

import { ThreadCompactor } from "./compaction";
import { ThreadPersistenceError } from "./errors";
import type {
  CompactThreadOptions,
  CompactThreadResult,
  CreateThreadParams,
  SaveThreadMessageParams,
  ThreadMessageRecord,
  ThreadPricingCalculator,
  ThreadRecord,
  ThreadRepository,
} from "./types";
import {
  aggregateContextSize,
  aggregateThreadUsage,
  emptyContextSize,
  emptyUsage,
  resolveMessageCost,
} from "./usage";

const THREAD_SCHEMA_VERSION = 1;
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

export interface FileThreadRepositoryOptions {
  fs: FS;
  /**
   *  Default is `.threads`
   */
  dirPath?: string;
  pricingCalculator?: ThreadPricingCalculator;
}

export function createFileThreadRepository(
  options: FileThreadRepositoryOptions,
): ThreadRepository {
  const fs = options.fs;
  const pricingCalculator = options.pricingCalculator;
  const rootDir = options.dirPath || ".threads";
  const compactor = new ThreadCompactor();
  let writeQueue: Promise<void> = Promise.resolve();

  function recalculateUsageAndContext(thread: ThreadRecord): ThreadRecord {
    return {
      ...thread,
      usage: aggregateThreadUsage(thread.history),
      contextSize: aggregateContextSize(thread.history),
    };
  }

  function ensureThreadId(threadId: string): void {
    const valid = /^[A-Za-z0-9_-]+$/.test(threadId);
    if (!valid) {
      throw new ThreadPersistenceError(
        "INVALID_STATE",
        `Invalid thread id: ${threadId}`,
      );
    }
  }

  function threadFilePath(threadId: string): string {
    ensureThreadId(threadId);
    const fileName = `thread.${threadId}.jsonc`;
    return `${rootDir}/${fileName}`;
  }

  function isThreadFile(name: string): boolean {
    return /^thread\.[A-Za-z0-9_-]+\.jsonc$/.test(name);
  }

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

  async function waitForPendingWrites(): Promise<void> {
    await writeQueue;
  }

  async function readThreadFile(filePath: string): Promise<ThreadRecord> {
    try {
      const raw = await fs.readFile(filePath);
      const parsed = JSON.parse(raw) as unknown;
      const result = threadRecordSchema.safeParse(parsed);

      if (!result.success) {
        throw new ThreadPersistenceError(
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

      if (error instanceof ThreadPersistenceError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new ThreadPersistenceError(
          "VALIDATION_ERROR",
          "Persisted thread state is not valid JSON.",
          error,
        );
      }

      throw new ThreadPersistenceError(
        "READ_ERROR",
        `Failed to read persisted thread state from ${filePath}.`,
        error,
      );
    }
  }

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

  async function writeThread(thread: ThreadRecord): Promise<void> {
    const validated = threadRecordSchema.safeParse(thread);
    if (!validated.success) {
      throw new ThreadPersistenceError(
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
      throw new ThreadPersistenceError(
        "WRITE_ERROR",
        `Failed to write persisted thread state for ${thread.id}.`,
        error,
      );
    }
  }

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
        throw new ThreadPersistenceError(
          "INVALID_STATE",
          `Thread already exists: ${thread.id}`,
        );
      }

      await writeThread(thread);
      return thread;
    });
  }

  async function getThread(threadId: string): Promise<ThreadRecord | null> {
    await waitForPendingWrites();
    return readThread(threadId);
  }

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

      throw new ThreadPersistenceError(
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

  async function softDeleteThread(
    threadId: string,
    options?: { deletedAt?: string },
  ): Promise<boolean> {
    return withLock(async () => {
      const thread = await readThread(threadId);

      if (!thread) {
        return false;
      }

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

function toWorkspaceRelativePath(path: string, root: string): string {
  if (path === root) {
    return ".";
  }

  const prefix = `${root}/`;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }

  throw new ThreadPersistenceError(
    "INVALID_STATE",
    `Resolved path "${path}" is outside workspace root "${root}".`,
  );
}
