import type { ModelMessage } from "ai";

export interface ThreadUsage {
  inputTokens: number;
  outputTokens: number;
  totalDurationMs: number;
  totalCostUsd: number;
}

export interface ContextSize {
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ThreadMessageRecord {
  id: string;
  ordinal: number;
  version: number;
  message: ModelMessage;
  usage: ThreadUsage;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  error: string | null;
}

export interface ThreadRecord {
  id: string;
  history: ThreadMessageRecord[];
  activeHistory: ThreadMessageRecord[];
  lastCompactionOrdinal: number | null;
  contextSize: ContextSize;
  usage: ThreadUsage;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ThreadPricingCalculator {
  calculateCost(args: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
  }): number;
}

export interface CreateThreadParams {
  id?: string;
  createdAt?: string;
}

export interface SaveThreadMessageParams {
  id?: string;
  message: ModelMessage;
  modelId?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalDurationMs: number;
    totalCostUsd?: number;
  };
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompactionPolicy {
  maxContextTokens: number;
  reservedOutputTokens?: number;
}

export interface CompactThreadOptions {
  policy: CompactionPolicy;
  summarizeHistory: (history: ThreadMessageRecord[]) => Promise<ModelMessage>;
  now?: string;
}

export interface CompactThreadResult {
  didCompact: boolean;
  thread: ThreadRecord;
}

export interface ThreadRepository {
  createThread(params?: CreateThreadParams): Promise<ThreadRecord>;
  getThread(threadId: string): Promise<ThreadRecord | null>;
  listThreads(params?: { includeDeleted?: boolean }): Promise<ThreadRecord[]>;
  saveMessage(
    threadId: string,
    payload: SaveThreadMessageParams,
  ): Promise<ThreadRecord | null>;
  softDeleteThread(
    threadId: string,
    options?: { deletedAt?: string },
  ): Promise<boolean>;
  rebuildActiveHistory(
    threadId: string,
    options?: { now?: string },
  ): Promise<ThreadRecord | null>;
  compactIfNeeded(
    threadId: string,
    options: CompactThreadOptions,
  ): Promise<CompactThreadResult | null>;
  updateThreadUsage(threadId: string): Promise<ThreadRecord | null>;
  updateContextSize(threadId: string): Promise<ThreadRecord | null>;
}
