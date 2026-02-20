import { convertToModelMessages, type UIMessage } from "ai";
import { createRootAgent } from "@protean/protean";
import type { ThreadMessageRecord } from "@protean/agent-memory";
import { requireUserId } from "@/lib/server/auth-user";
import { getAgentMemory } from "@/lib/server/agent-memory";
import { findModel } from "@/lib/server/models/model-catalog";
import {
  isSameModelSelection,
  normalizeThreadModelSelection,
  parseLooseModelSelection,
  resolveModelSelection,
} from "@/lib/server/models/model-selection";
import { canAccessThread, threadToUiMessages } from "@/lib/server/thread-utils";
import { consoleLogger } from "@protean/logger";
import { createLocalFs } from "@protean/vfs";

export const maxDuration = 30;

function isPendingMessage(message: UIMessage): boolean {
  const metadata = (
    message as UIMessage & {
      metadata?: unknown;
    }
  ).metadata;

  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return (metadata as Record<string, unknown>).pending === true;
}

function clearPendingFlag(message: UIMessage): UIMessage {
  const metadata = (
    message as UIMessage & {
      metadata?: unknown;
    }
  ).metadata;

  if (!metadata || typeof metadata !== "object") {
    return message;
  }

  const nextMetadata = { ...(metadata as Record<string, unknown>) };
  delete nextMetadata.pending;

  return {
    ...message,
    metadata: nextMetadata,
  } as UIMessage;
}

function summarizeHistory(history: ThreadMessageRecord[]): UIMessage {
  const summaryText = history
    .map((item) => {
      const parts = item.message.parts as Array<{
        type: string;
        text?: string;
      }>;

      return parts
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join(" ")
        .trim();
    })
    .filter((text) => text.length > 0)
    .join("\n")
    .slice(-4000);

  return {
    id: `summary-${Date.now()}`,
    role: "user",
    parts: [
      {
        type: "text",
        text: summaryText || "Conversation summary.",
      },
    ],
  };
}

export async function POST(request: Request) {
  const [userId, body] = await Promise.all([
    requireUserId(),
    request.json().catch(() => null),
  ]);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = body as {
    invokePending?: boolean;
    modelId?: unknown;
    messages?: UIMessage[];
    modelSelection?: unknown;
    providerId?: unknown;
    thinkingBudget?: unknown;
    threadId?: string;
  } | null;

  if (!parsedBody?.threadId) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const threadId = parsedBody.threadId;
  const memory = await getAgentMemory();

  const thread = await memory.getThreadWithMessages(threadId);
  if (!thread || !canAccessThread(thread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const fs = await createLocalFs(
    `/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project/${userId}`,
    consoleLogger,
  );

  // For making sure the model selection and the reasoning budget are valid.
  const threadSelection = normalizeThreadModelSelection({
    providerId: thread.modelSelection.providerId,
    modelId: thread.modelSelection.modelId,
    reasoningBudget: thread.modelSelection.reasoningBudget,
  });
  const requestSelection = parseLooseModelSelection(parsedBody.modelSelection);
  const resolvedModelSelection = resolveModelSelection({
    requestSelection,
    threadSelection,
  });

  if (!isSameModelSelection(threadSelection, resolvedModelSelection)) {
    await memory.updateThreadSettings(threadId, {
      modelSelection: resolvedModelSelection,
    });
  }

  /** The full model entry from openrouter */
  const resolvedFullModelEntry = findModel(
    resolvedModelSelection.providerId,
    resolvedModelSelection.modelId,
  );

  if (!resolvedFullModelEntry) {
    return Response.json(
      { error: "No valid model configuration available." },
      { status: 500 },
    );
  }

  let uiMessages: UIMessage[];
  const threadMessages = threadToUiMessages(thread);

  if (parsedBody.invokePending) {
    const pendingIndex = [...threadMessages]
      .map((message, index) => ({ index, message }))
      .reverse()
      .find(
        ({ message }) => message.role === "user" && isPendingMessage(message),
      )?.index;

    if (pendingIndex === undefined) {
      return Response.json(
        { error: "No pending thread message found" },
        { status: 409 },
      );
    }

    uiMessages = threadMessages.map((message, index) =>
      index === pendingIndex ? clearPendingFlag(message) : message,
    );
  } else {
    if (!Array.isArray(parsedBody.messages)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    uiMessages = parsedBody.messages;
  }

  if (
    resolvedFullModelEntry.runtimeProvider === "openrouter" &&
    !process.env.OPENROUTER_API_KEY
  ) {
    return Response.json(
      { error: "Missing OPENROUTER_API_KEY" },
      { status: 500 },
    );
  }

  const agent = await createRootAgent(
    {
      fs,
      modelSelection: {
        providerId: resolvedFullModelEntry.runtimeProvider,
        modelId: resolvedModelSelection.modelId,
        reasoningBudget: resolvedModelSelection.reasoningBudget,
      },
    },
    consoleLogger,
  );

  const existingByMessageId = new Map(
    thread.history
      .filter((record) => record.deletedAt === null)
      .map((record) => [record.message.id, record]),
  );

  for (const message of uiMessages) {
    const existingRecord = existingByMessageId.get(message.id);
    await memory.upsertMessage(threadId, {
      ...(existingRecord ? { id: existingRecord.id } : {}),
      message,
      modelSelection: resolvedModelSelection,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalDurationMs: 0,
      },
    });
  }

  await memory.compactIfNeeded(threadId, {
    policy: {
      maxContextTokens: resolvedFullModelEntry.contextLimits.total,
      reservedOutputTokens: resolvedFullModelEntry.contextLimits.maxOutput,
    },
    summarizeHistory: async (history) => summarizeHistory(history),
  });

  const hydratedThread = await memory.getThreadWithMessages(threadId);
  if (!hydratedThread || !canAccessThread(hydratedThread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const streamStartMs = Date.now();
  const stream = await agent.stream({
    messages: await convertToModelMessages(
      hydratedThread.activeHistory
        .filter((record) => record.deletedAt === null)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((record) => record.message),
    ),
  });

  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: false,
    originalMessages: uiMessages as never[],
    onFinish: async ({ messages }) => {
      const finishMessages = messages as UIMessage[];
      const reloaded = await memory.getThreadWithMessages(threadId);
      if (!reloaded || !canAccessThread(reloaded, userId)) {
        return;
      }

      const existingIds = new Set(
        reloaded.history
          .filter((record) => record.deletedAt === null)
          .map((record) => record.message.id),
      );
      const toPersist = finishMessages.filter(
        (message) => !existingIds.has(message.id),
      );

      if (toPersist.length === 0) {
        return;
      }

      const duration = Math.max(Date.now() - streamStartMs, 0);
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const usage = await stream.usage;
        inputTokens = usage.inputTokens ?? 0;
        outputTokens = usage.outputTokens ?? 0;
      } catch {
        inputTokens = 0;
        outputTokens = 0;
      }

      const assistantCandidates = toPersist.filter(
        (message) => message.role === "assistant",
      );
      const usageTargetId =
        assistantCandidates[assistantCandidates.length - 1]?.id ??
        toPersist[toPersist.length - 1]?.id;

      for (const message of toPersist) {
        const shouldAssignUsage = message.id === usageTargetId;
        await memory.upsertMessage(threadId, {
          message,
          modelSelection: resolvedModelSelection,
          usage: {
            inputTokens: shouldAssignUsage ? inputTokens : 0,
            outputTokens: shouldAssignUsage ? outputTokens : 0,
            totalDurationMs: shouldAssignUsage ? duration : 0,
          },
        });
      }
    },
    onError: (error) => {
      if (error instanceof Error) {
        return error.message;
      }

      return "Failed to stream response from model.";
    },
  });
}
