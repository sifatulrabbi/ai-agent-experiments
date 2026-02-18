import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { UIMessage } from "ai";
import { createLocalFs, type FS } from "@protean/vfs";

import { createFsMemory, type ThreadPricingCalculator } from "../index";

const defaultModelSelection = {
  providerId: "openrouter",
  modelId: "moonshotai/kimi-k2.5",
  reasoningBudget: "medium",
};

let root: string;
let threadsDir: string;
let fs: FS;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fs-memory-test-"));
  fs = await createLocalFs(root);
  threadsDir = ".threads";
});

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

function createRepository(pricingCalculator?: ThreadPricingCalculator) {
  return createFsMemory({
    fs,
    dirPath: threadsDir,
    pricingCalculator,
  });
}

function textMessage(
  role: UIMessage["role"],
  text: string,
  options?: { id?: string; metadata?: UIMessage["metadata"] },
): UIMessage {
  return {
    id: options?.id ?? randomUUID(),
    role,
    parts: [{ type: "text", text }],
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  };
}

describe("createFsMemory", () => {
  test("creates thread with empty history and active history", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      title: "My Thread",
      modelSelection: defaultModelSelection,
    });

    expect(thread.history).toEqual([]);
    expect(thread.activeHistory).toEqual([]);
    expect(thread.lastCompactionOrdinal).toBeNull();
    expect(thread.deletedAt).toBeNull();
    expect(thread.userId).toBe("user-1");
    expect(thread.title).toBe("My Thread");
    expect(thread.modelSelection?.providerId).toBe("openrouter");
  });

  test("filters listThreads by user id", async () => {
    const repo = createRepository();
    await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });
    await repo.createThread({
      userId: "user-2",
      modelSelection: defaultModelSelection,
    });

    const user1 = await repo.listThreads({ userId: "user-1" });
    expect(user1.length).toBe(1);
    expect(user1[0]?.userId).toBe("user-1");
  });

  test("updates thread metadata via updateThreadSettings", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });
    const updated = await repo.updateThreadSettings(thread.id, {
      title: "Renamed",
      modelSelection: {
        providerId: "openrouter",
        modelId: "gpt-5",
        reasoningBudget: "high",
      },
    });

    expect(updated?.title).toBe("Renamed");
    expect(updated?.modelSelection?.modelId).toBe("gpt-5");
  });

  test("replaceMessages updates existing message payloads in-place", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });
    const messageId = randomUUID();

    await repo.saveMessage(thread.id, {
      message: textMessage("user", "pending", { id: messageId }),
      usage: {
        inputTokens: 2,
        outputTokens: 0,
        totalDurationMs: 1,
      },
      modelSelection: defaultModelSelection,
    });

    const replaced = await repo.replaceMessages(thread.id, {
      messages: [
        {
          id: messageId,
          role: "user",
          parts: [{ type: "text", text: "finalized" }],
        },
      ],
    });

    expect(replaced?.history.length).toBe(1);
    expect(replaced?.history[0]?.message.parts).toEqual([
      { type: "text", text: "finalized" },
    ]);
  });

  test("saves first user message with ordinal 1", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const updated = await repo.saveMessage(thread.id, {
      message: textMessage("user", "hello"),
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        totalDurationMs: 50,
      },
      modelSelection: defaultModelSelection,
    });

    expect(updated).not.toBeNull();
    expect(updated?.history.length).toBe(1);
    expect(updated?.history[0]?.ordinal).toBe(1);
  });

  test("persists and reloads ui message fidelity", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const message: UIMessage = {
      id: "assistant-1",
      role: "assistant",
      metadata: {
        source: "tool-call",
      },
      parts: [
        { type: "text", text: "calling a tool" },
        { type: "text", text: "tool returned success" },
      ],
    };

    await repo.saveMessage(thread.id, {
      message,
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalDurationMs: 20,
      },
      modelSelection: defaultModelSelection,
    });

    const reloadedRepo = createRepository();
    const reloaded = await reloadedRepo.getThread(thread.id);

    expect(reloaded?.history[0]?.message).toEqual(message);
  });

  test("aggregates usage and context over multiple messages", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    await repo.saveMessage(thread.id, {
      message: textMessage("user", "first"),
      usage: {
        inputTokens: 10,
        outputTokens: 1,
        totalDurationMs: 100,
      },
      modelSelection: defaultModelSelection,
    });

    const updated = await repo.saveMessage(thread.id, {
      message: textMessage("assistant", "second"),
      usage: {
        inputTokens: 3,
        outputTokens: 8,
        totalDurationMs: 250,
      },
      modelSelection: defaultModelSelection,
    });

    expect(updated?.usage.inputTokens).toBe(13);
    expect(updated?.usage.outputTokens).toBe(9);
    expect(updated?.usage.totalDurationMs).toBe(350);
    expect(updated?.contextSize.totalInputTokens).toBe(13);
    expect(updated?.contextSize.totalOutputTokens).toBe(9);
  });

  test("soft delete marks thread and list hides it by default", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const deleted = await repo.softDeleteThread(thread.id);
    expect(deleted).toBe(true);

    const visible = await repo.listThreads();
    expect(visible.find((item) => item.id === thread.id)).toBeUndefined();

    const all = await repo.listThreads({ includeDeleted: true });
    const deletedThread = all.find((item) => item.id === thread.id);
    expect(deletedThread?.deletedAt).not.toBeNull();
  });

  test("compaction summarizes full history into a single user message", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    await repo.saveMessage(thread.id, {
      message: textMessage("user", "hello"),
      usage: {
        inputTokens: 400,
        outputTokens: 20,
        totalDurationMs: 10,
      },
      modelSelection: defaultModelSelection,
    });

    await repo.saveMessage(thread.id, {
      message: textMessage("assistant", "response"),
      usage: {
        inputTokens: 100,
        outputTokens: 100,
        totalDurationMs: 10,
      },
      modelSelection: defaultModelSelection,
    });

    const compacted = await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 200,
      },
      summarizeHistory: async (history) => ({
        id: randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: `summary:${history.length}` }],
      }),
    });

    expect(compacted).not.toBeNull();
    expect(compacted?.didCompact).toBe(true);
    expect(compacted?.thread.activeHistory.length).toBe(1);
    expect(compacted?.thread.activeHistory[0]?.message.role).toBe("user");
    expect(compacted?.thread.activeHistory[0]?.message.parts).toEqual([
      { type: "text", text: "summary:2" },
    ]);
    expect(compacted?.thread.lastCompactionOrdinal).toBe(2);
  });

  test("compaction no-op when context fits", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    await repo.saveMessage(thread.id, {
      message: textMessage("user", "small"),
      usage: {
        inputTokens: 5,
        outputTokens: 3,
        totalDurationMs: 10,
      },
      modelSelection: defaultModelSelection,
    });

    const compacted = await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 100,
      },
      summarizeHistory: async () => ({
        id: randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: "summary" }],
      }),
    });

    expect(compacted?.didCompact).toBe(false);
    expect(compacted?.thread.activeHistory.length).toBe(1);
    expect(compacted?.thread.lastCompactionOrdinal).toBeNull();
  });

  test("rebuildActiveHistory resets active history to full history and clears compaction marker", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    await repo.saveMessage(thread.id, {
      message: textMessage("user", "a"),
      usage: {
        inputTokens: 300,
        outputTokens: 10,
        totalDurationMs: 10,
      },
      modelSelection: defaultModelSelection,
    });

    await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 100,
      },
      summarizeHistory: async () => ({
        id: randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: "s" }],
      }),
    });

    const rebuilt = await repo.rebuildActiveHistory(thread.id);

    expect(rebuilt?.activeHistory.length).toBe(1);
    expect(rebuilt?.activeHistory[0]?.message.role).toBe("user");
    expect(rebuilt?.lastCompactionOrdinal).toBeNull();
  });

  test("concurrent saves preserve monotonic ordinal without data loss", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const count = 30;
    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        repo.saveMessage(thread.id, {
          message: textMessage("user", `message-${idx}`),
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalDurationMs: 1,
          },
          modelSelection: defaultModelSelection,
        }),
      ),
    );

    const reloaded = await repo.getThread(thread.id);
    const ordinals = reloaded?.history.map((item) => item.ordinal) ?? [];

    expect(ordinals.length).toBe(count);
    expect(new Set(ordinals).size).toBe(count);
    expect(ordinals.slice().sort((a, b) => a - b)).toEqual(
      Array.from({ length: count }, (_, idx) => idx + 1),
    );
  });

  test("uses injected pricing calculator when cost is not provided", async () => {
    const repo = createRepository({
      calculateCost: ({ inputTokens, outputTokens }) =>
        (inputTokens + outputTokens) * 0.01,
    });

    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const updated = await repo.saveMessage(thread.id, {
      message: textMessage("user", "price me"),
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalDurationMs: 5,
      },
      modelSelection: { ...defaultModelSelection, modelId: "some-model" },
    });

    expect(updated?.history[0]?.usage.totalCostUsd).toBe(0.15);
  });

  test("writes per-thread json file with schema versions", async () => {
    const repo = createRepository();
    const thread = await repo.createThread({
      userId: "user-1",
      modelSelection: defaultModelSelection,
    });

    const threadFilePath = `${threadsDir}/thread.${thread.id}.json`;
    const raw = await fs.readFile(threadFilePath);
    const parsed = JSON.parse(raw) as {
      schemaVersion: number;
      contentSchemaVersion: number;
      id: string;
      history: unknown[];
    };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.contentSchemaVersion).toBe(1);
    expect(parsed.id).toBe(thread.id);
    expect(parsed.history.length).toBe(0);
  });
});
