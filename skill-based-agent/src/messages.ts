import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ModelMessage } from "ai";

/**
 * A simple file-backed message store for persisting conversation history.
 * Messages are stored as a JSON array of ModelMessage objects.
 */
export interface MessageStore {
  load(): Promise<ModelMessage[]>;
  save(messages: ModelMessage[]): Promise<void>;
}

export function createFileMessageStore(filePath: string): MessageStore {
  return {
    async load(): Promise<ModelMessage[]> {
      try {
        const raw = await readFile(filePath, "utf-8");
        return JSON.parse(raw) as ModelMessage[];
      } catch {
        return [];
      }
    },

    async save(messages: ModelMessage[]): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(messages, null, 2), "utf-8");
    },
  };
}
