import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { createRootAgent } from "@protean/protean";
import { chatRepository } from "@/lib/server/chat-repository";
import { requireUserId } from "@/lib/server/auth-user";
import { DEFAULT_MODEL } from "@/lib/server/provider-factory";
import {
  DEFAULT_CHAT_PROVIDER_ID,
  getModelById,
  getModelReasoningById,
  type ReasoningBudget,
} from "@/components/chat/model-catalog";
import { AgentsFactory } from "@/lib/server/agents";

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
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: UIMessage[];
    invokePending?: boolean;
    modelId?: string;
    providerId?: string;
    thinkingBudget?: ReasoningBudget;
    threadId?: string;
  } | null;

  if (!body?.threadId) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const threadId = body.threadId;

  const thread = await chatRepository.getThread(userId, threadId);

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  let uiMessages: UIMessage[];

  if (body.invokePending) {
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
    if (!Array.isArray(body.messages)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    uiMessages = body.messages;
  }

  // Persist client-side messages immediately for normal sends so user input is
  // not lost when the model call fails or is aborted.
  if (!body.invokePending) {
    await chatRepository.saveMessages({
      messages: uiMessages,
      threadId,
      userId,
    });
  }

  // Existing chat-with-LLM route logic intentionally kept for fallback/reference.
  // const modelId = typeof body.modelId === "string" ? body.modelId : undefined;
  // const providerId =
  //   typeof body.providerId === "string" && body.providerId.trim().length > 0
  //     ? body.providerId
  //     : DEFAULT_CHAT_PROVIDER_ID;
  // const selectedModel = modelId ? getModelById(providerId, modelId) : undefined;
  // const fallbackModel =
  //   getModelById(DEFAULT_CHAT_PROVIDER_ID, DEFAULT_MODEL) ??
  //   getModelById(DEFAULT_CHAT_PROVIDER_ID, "openai/gpt-5.2");
  //
  // if (!selectedModel && !fallbackModel) {
  //   return Response.json(
  //     { error: "No valid model configuration available." },
  //     { status: 500 },
  //   );
  // }
  //
  // const resolvedModel = selectedModel ?? fallbackModel!;
  // const resolvedProviderId = selectedModel
  //   ? providerId
  //   : DEFAULT_CHAT_PROVIDER_ID;
  // const resolvedReasoning = getModelReasoningById(
  //   resolvedProviderId,
  //   resolvedModel.id,
  // );
  // const requestedReasoningBudget = body.thinkingBudget;
  // const reasoningBudget =
  //   requestedReasoningBudget &&
  //   resolvedReasoning?.budgets.includes(requestedReasoningBudget)
  //     ? requestedReasoningBudget
  //     : resolvedReasoning?.defaultValue;
  //
  // if (
  //   resolvedModel.provider === "openrouter" &&
  //   !process.env.OPENROUTER_API_KEY
  // ) {
  //   return Response.json(
  //     { error: "Missing OPENROUTER_API_KEY" },
  //     { status: 500 },
  //   );
  // }
  //
  // if (resolvedModel.provider === "openai" && !process.env.OPENAI_API_KEY) {
  //   return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  // }
  // const agent = AgentsFactory.getAgent(resolvedModel, {
  //   reasoningBudget,
  // });
  // const p = await agent.stream({ messages: [] });

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "Missing OPENROUTER_API_KEY" },
      { status: 500 },
    );
  }

  const agent = await createRootAgent();

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
