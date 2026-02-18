import type { ThreadRecord } from "@protean/agent-memory";
import type { UIMessage } from "ai";

export function threadToUiMessages(thread: ThreadRecord): UIMessage[] {
  return thread.history
    .filter((message) => message.deletedAt === null)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((message) => message.message);
}

export function canAccessThread(thread: ThreadRecord, userId: string): boolean {
  return thread.userId === userId && thread.deletedAt === null;
}
