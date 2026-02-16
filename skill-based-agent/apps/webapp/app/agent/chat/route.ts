import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { createRootAgent } from "@protean/protean";
import { requireUserId } from "@/lib/server/auth-user";
import { chatRepository } from "@/lib/server/chat-repository";
import { findModel } from "@/lib/server/models/model-catalog";
import {
  isSameModelSelection,
  parseLegacyModelSelection,
  parseLooseModelSelection,
  resolveModelSelection,
} from "@/lib/server/models/model-selection";

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

  const thread = await chatRepository.getThread(userId, threadId);

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const requestSelection =
    parseLooseModelSelection(parsedBody.modelSelection) ??
    parseLegacyModelSelection(parsedBody);

  const resolvedModelSelection = resolveModelSelection({
    requestSelection,
    threadSelection: thread.modelSelection,
  });

  if (!isSameModelSelection(thread.modelSelection, resolvedModelSelection)) {
    await chatRepository.updateThreadSettings({
      modelSelection: resolvedModelSelection,
      threadId,
      userId,
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

  if (parsedBody.invokePending) {
    const pendingIndex = [...thread.messages]
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

    uiMessages = thread.messages.map((message, index) =>
      index === pendingIndex ? clearPendingFlag(message) : message,
    );
  } else {
    if (!Array.isArray(parsedBody.messages)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    uiMessages = parsedBody.messages;
  }

  if (!parsedBody.invokePending) {
    await chatRepository.saveMessages({
      messages: uiMessages,
      threadId,
      userId,
    });
  }

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

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    sendReasoning: true,
    sendSources: false,
    originalMessages: uiMessages as never[],
    onFinish: async ({ messages }) => {
      await chatRepository.saveMessages({
        messages,
        threadId,
        userId,
      });
    },
    onError: (error) => {
      if (error instanceof Error) {
        return error.message;
      }

      return "Failed to stream response from model.";
    },
  });
}
