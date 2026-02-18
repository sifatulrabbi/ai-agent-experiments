/**
 * agent-memory — filesystem-backed conversation thread persistence.
 *
 * Primary entry point:
 * ```ts
 * import { createFsMemory } from "@your-scope/agent-memory";
 * const memory = createFsMemory({ fs: yourFsAdapter });
 * ```
 */
export { ThreadMemoryError } from "./errors";
export { createHistoryCompactor } from "./compaction";
export { createFsMemory } from "./fs-memory";
export type { FsMemoryOptions } from "./fs-memory";

export type {
  ThreadMessageRecord,
  ThreadRecord,
  ThreadUsage,
  ContextSize,
  FsMemory,
  ThreadModelSelection,
  ThreadPricingCalculator,
  CompactionPolicy,
  CompactThreadOptions,
  CompactThreadResult,
  CreateThreadParams,
  ReplaceThreadMessagesParams,
  SaveThreadMessageParams,
  UpdateThreadSettingsParams,
} from "./types";
