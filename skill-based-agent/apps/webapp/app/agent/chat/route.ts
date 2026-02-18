import { type UIMessage } from "ai";
import { createRootAgent } from "@protean/protean";
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

  const thread = await memory.getThread(threadId);
  if (!thread || !canAccessThread(thread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

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

  const resolvedModel = findModel(
    resolvedModelSelection.providerId,
    resolvedModelSelection.modelId,
  );

  if (!resolvedModel) {
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

  await memory.replaceMessages(threadId, { messages: uiMessages });

  if (
    resolvedModel.runtimeProvider === "openrouter" &&
    !process.env.OPENROUTER_API_KEY
  ) {
    return Response.json(
      { error: "Missing OPENROUTER_API_KEY" },
      { status: 500 },
    );
  }

  const agent = await createRootAgent({
    modelId: resolvedModel.id,
    reasoningBudget: resolvedModelSelection.reasoningBudget,
    runtimeProvider: resolvedModel.runtimeProvider,
  });

  const streamSession = await agent.streamThread({
    threadId,
    uiMessages,
    options: {
      modelSelection: {
        providerId: resolvedModelSelection.providerId,
        modelId: resolvedModelSelection.modelId,
        reasoningBudget: resolvedModelSelection.reasoningBudget,
      },
      memory: {
        memory,
        compactionPolicy: {
          maxContextTokens: Math.max(resolvedModel.contextLimits.total, 1),
          reservedOutputTokens: Math.min(
            resolvedModel.contextLimits.maxOutput,
            4096,
          ),
        },
        summarizeHistory: async (history) => {
          // TODO: use a LLM based approach to compact the history, put the logic in the packages/protean.

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
        },
      },
    },
  });

  return streamSession.stream.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: false,
    originalMessages: uiMessages as never[],
    onFinish: async ({ messages }) => {
      await streamSession.persistFinish(messages);
    },
    onError: (error) => {
      if (error instanceof Error) {
        return error.message;
      }

      return "Failed to stream response from model.";
    },
  });
}
