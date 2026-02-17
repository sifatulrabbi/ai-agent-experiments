import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ModelMessage } from "ai";
import { createLocalFs, type FS } from "@protean/vfs";

import {
  createFileThreadRepository,
  type ThreadPricingCalculator,
} from "../index";

let root: string;
let threadsDir: string;
let fs: FS;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "thread-repo-test-"));
  fs = await createLocalFs(root);
  threadsDir = ".threads";
});

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

function createRepository(pricingCalculator?: ThreadPricingCalculator) {
  return createFileThreadRepository({
    fs,
    dirPath: threadsDir,
    pricingCalculator,
  });
}

describe("createFileThreadRepository", () => {
  test("creates thread with empty history and active history", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    expect(thread.history).toEqual([]);
    expect(thread.activeHistory).toEqual([]);
    expect(thread.lastCompactionOrdinal).toBeNull();
    expect(thread.deletedAt).toBeNull();
  });

  test("saves first user message with ordinal 1", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    const updated = await repo.saveMessage(thread.id, {
      message: { role: "user", content: "hello" },
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        totalDurationMs: 50,
      },
      modelId: "test-model",
    });

    expect(updated).not.toBeNull();
    expect(updated?.history.length).toBe(1);
    expect(updated?.history[0]?.ordinal).toBe(1);
  });

  test("persists and reloads model message fidelity", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    const message: ModelMessage = {
      role: "assistant",
      content: [
        { type: "text", text: "calling a tool" },
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "ToolA",
          input: { hello: "world" },
        },
      ],
    };

    await repo.saveMessage(thread.id, {
      message,
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalDurationMs: 20,
      },
    });

    const reloadedRepo = createRepository();
    const reloaded = await reloadedRepo.getThread(thread.id);

    expect(reloaded?.history[0]?.message).toEqual(message);
  });

  test("aggregates usage and context over multiple messages", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    await repo.saveMessage(thread.id, {
      message: { role: "user", content: "first" },
      usage: {
        inputTokens: 10,
        outputTokens: 1,
        totalDurationMs: 100,
      },
      modelId: "model-x",
    });

    const updated = await repo.saveMessage(thread.id, {
      message: { role: "assistant", content: "second" },
      usage: {
        inputTokens: 3,
        outputTokens: 8,
        totalDurationMs: 250,
      },
      modelId: "model-x",
    });

    expect(updated?.usage.inputTokens).toBe(13);
    expect(updated?.usage.outputTokens).toBe(9);
    expect(updated?.usage.totalDurationMs).toBe(350);
    expect(updated?.contextSize.totalInputTokens).toBe(13);
    expect(updated?.contextSize.totalOutputTokens).toBe(9);
  });

  test("soft delete marks thread and list hides it by default", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

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
    const thread = await repo.createThread();

    await repo.saveMessage(thread.id, {
      message: { role: "user", content: "hello" },
      usage: {
        inputTokens: 400,
        outputTokens: 20,
        totalDurationMs: 10,
      },
    });

    await repo.saveMessage(thread.id, {
      message: { role: "assistant", content: "response" },
      usage: {
        inputTokens: 100,
        outputTokens: 100,
        totalDurationMs: 10,
      },
    });

    const compacted = await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 200,
      },
      summarizeHistory: async (history) => ({
        role: "assistant",
        content: `summary:${history.length}`,
      }),
    });

    expect(compacted).not.toBeNull();
    expect(compacted?.didCompact).toBe(true);
    expect(compacted?.thread.activeHistory.length).toBe(1);
    expect(compacted?.thread.activeHistory[0]?.message.role).toBe("user");
    expect(compacted?.thread.lastCompactionOrdinal).toBe(2);
  });

  test("compaction no-op when context fits", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    await repo.saveMessage(thread.id, {
      message: { role: "user", content: "small" },
      usage: {
        inputTokens: 5,
        outputTokens: 3,
        totalDurationMs: 10,
      },
    });

    const compacted = await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 100,
      },
      summarizeHistory: async () => ({
        role: "assistant",
        content: "summary",
      }),
    });

    expect(compacted?.didCompact).toBe(false);
    expect(compacted?.thread.activeHistory.length).toBe(1);
    expect(compacted?.thread.lastCompactionOrdinal).toBeNull();
  });

  test("rebuildActiveHistory resets active history to full history and clears compaction marker", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    await repo.saveMessage(thread.id, {
      message: { role: "user", content: "a" },
      usage: {
        inputTokens: 300,
        outputTokens: 10,
        totalDurationMs: 10,
      },
    });

    await repo.compactIfNeeded(thread.id, {
      policy: {
        maxContextTokens: 100,
      },
      summarizeHistory: async () => ({ role: "assistant", content: "s" }),
    });

    const rebuilt = await repo.rebuildActiveHistory(thread.id);

    expect(rebuilt?.activeHistory.length).toBe(1);
    expect(rebuilt?.activeHistory[0]?.message.role).toBe("user");
    expect(rebuilt?.lastCompactionOrdinal).toBeNull();
  });

  test("concurrent saves preserve monotonic ordinal without data loss", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    const count = 30;
    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        repo.saveMessage(thread.id, {
          message: { role: "user", content: `message-${idx}` },
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalDurationMs: 1,
          },
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

    const thread = await repo.createThread();

    const updated = await repo.saveMessage(thread.id, {
      message: { role: "user", content: "price me" },
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalDurationMs: 5,
      },
      modelId: "some-model",
    });

    expect(updated?.history[0]?.usage.totalCostUsd).toBe(0.15);
  });

  test("writes per-thread jsonc file with schema versions", async () => {
    const repo = createRepository();
    const thread = await repo.createThread();

    const threadFilePath = `${threadsDir}/thread.${thread.id}.jsonc`;
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
