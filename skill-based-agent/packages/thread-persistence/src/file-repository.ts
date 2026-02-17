import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { modelMessageSchema } from "ai";
import { z } from "zod";

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

const persistedStateSchema = z.object({
  version: z.literal(1),
  threads: z.array(threadRecordSchema),
});

type PersistedState = z.infer<typeof persistedStateSchema>;

export interface FileThreadRepositoryOptions {
  filePath: string;
  pricingCalculator?: ThreadPricingCalculator;
}

export class FileThreadRepository implements ThreadRepository {
  private readonly filePath: string;
  private readonly pricingCalculator?: ThreadPricingCalculator;
  private readonly compactor: ThreadCompactor;
  private writeQueue: Promise<void>;

  constructor(options: FileThreadRepositoryOptions) {
    this.filePath = options.filePath;
    this.pricingCalculator = options.pricingCalculator;
    this.compactor = new ThreadCompactor();
    this.writeQueue = Promise.resolve();
  }

  async createThread(params?: CreateThreadParams): Promise<ThreadRecord> {
    const now = params?.createdAt ?? new Date().toISOString();
    const thread: ThreadRecord = {
      id: params?.id ?? randomUUID(),
      history: [],
      activeHistory: [],
      lastCompactionOrdinal: null,
      contextSize: emptyContextSize(),
      usage: emptyUsage(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    return this.withLock(async () => {
      const state = await this.readState();
      state.threads.push(thread);
      await this.writeState(state);
      return thread;
    });
  }

  async getThread(threadId: string): Promise<ThreadRecord | null> {
    await this.waitForPendingWrites();
    const state = await this.readState();
    const thread = state.threads.find((item) => item.id === threadId);
    return thread ?? null;
  }

  async listThreads(params?: {
    includeDeleted?: boolean;
  }): Promise<ThreadRecord[]> {
    await this.waitForPendingWrites();
    const state = await this.readState();
    const includeDeleted = params?.includeDeleted ?? false;

    return state.threads
      .filter((thread) => includeDeleted || thread.deletedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveMessage(
    threadId: string,
    payload: SaveThreadMessageParams,
  ): Promise<ThreadRecord | null> {
    const now = payload.updatedAt ?? new Date().toISOString();

    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return null;
      }

      const thread = state.threads[threadIndex];
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
          pricingCalculator: this.pricingCalculator,
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

      const withUsageAndContext =
        this.recalculateUsageAndContext(updatedThread);
      state.threads[threadIndex] = withUsageAndContext;
      await this.writeState(state);

      return withUsageAndContext;
    });
  }

  async softDeleteThread(
    threadId: string,
    options?: { deletedAt?: string },
  ): Promise<boolean> {
    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return false;
      }

      const thread = state.threads[threadIndex];
      if (!thread) {
        return false;
      }

      if (thread.deletedAt !== null) {
        return true;
      }

      state.threads[threadIndex] = {
        ...thread,
        deletedAt: options?.deletedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.writeState(state);
      return true;
    });
  }

  async rebuildActiveHistory(
    threadId: string,
    options?: { now?: string },
  ): Promise<ThreadRecord | null> {
    const now = options?.now ?? new Date().toISOString();

    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return null;
      }

      const thread = state.threads[threadIndex];
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

      const withUsageAndContext =
        this.recalculateUsageAndContext(updatedThread);
      state.threads[threadIndex] = withUsageAndContext;
      await this.writeState(state);

      return withUsageAndContext;
    });
  }

  async compactIfNeeded(
    threadId: string,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult | null> {
    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return null;
      }

      const thread = state.threads[threadIndex];
      if (!thread) {
        return null;
      }

      const compacted = await this.compactor.compactIfNeeded(thread, options);
      const nextThread = this.recalculateUsageAndContext(compacted.thread);
      state.threads[threadIndex] = nextThread;

      if (compacted.didCompact) {
        await this.writeState(state);
      }

      return {
        didCompact: compacted.didCompact,
        thread: nextThread,
      };
    });
  }

  async updateThreadUsage(threadId: string): Promise<ThreadRecord | null> {
    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return null;
      }

      const thread = state.threads[threadIndex];
      if (!thread) {
        return null;
      }

      const updatedThread: ThreadRecord = {
        ...thread,
        usage: aggregateThreadUsage(thread.history),
        updatedAt: new Date().toISOString(),
      };

      state.threads[threadIndex] = updatedThread;
      await this.writeState(state);

      return updatedThread;
    });
  }

  async updateContextSize(threadId: string): Promise<ThreadRecord | null> {
    return this.withLock(async () => {
      const state = await this.readState();
      const threadIndex = state.threads.findIndex(
        (item) => item.id === threadId,
      );

      if (threadIndex < 0) {
        return null;
      }

      const thread = state.threads[threadIndex];
      if (!thread) {
        return null;
      }

      const updatedThread: ThreadRecord = {
        ...thread,
        contextSize: aggregateContextSize(thread.history),
        updatedAt: new Date().toISOString(),
      };

      state.threads[threadIndex] = updatedThread;
      await this.writeState(state);

      return updatedThread;
    });
  }

  private recalculateUsageAndContext(thread: ThreadRecord): ThreadRecord {
    return {
      ...thread,
      usage: aggregateThreadUsage(thread.history),
      contextSize: aggregateContextSize(thread.history),
    };
  }

  private async withLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue;
    let release: () => void = () => {};

    this.writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }

  private async waitForPendingWrites(): Promise<void> {
    await this.writeQueue;
  }

  private async readState(): Promise<PersistedState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const result = persistedStateSchema.safeParse(parsed);

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
        return {
          version: 1,
          threads: [],
        };
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
        "Failed to read persisted thread state.",
        error,
      );
    }
  }

  private async writeState(state: PersistedState): Promise<void> {
    try {
      const result = persistedStateSchema.safeParse(state);
      if (!result.success) {
        throw new ThreadPersistenceError(
          "VALIDATION_ERROR",
          `Refusing to write invalid state: ${result.error.message}`,
          result.error,
        );
      }

      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
      const payload = JSON.stringify(result.data, null, 2);
      await writeFile(tempPath, payload, "utf8");
      await rename(tempPath, this.filePath);
    } catch (error) {
      if (error instanceof ThreadPersistenceError) {
        throw error;
      }

      throw new ThreadPersistenceError(
        "WRITE_ERROR",
        "Failed to write persisted thread state.",
        error,
      );
    }
  }
}
