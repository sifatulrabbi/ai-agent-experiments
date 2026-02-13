import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { buildAgent } from "@protean/protean";
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

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: UIMessage[];
    modelId?: string;
    providerId?: string;
    thinkingBudget?: ReasoningBudget;
    threadId?: string;
  } | null;

  if (!body?.threadId || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const threadId = body.threadId;

  const thread = await chatRepository.getThread(userId, threadId);

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  // Persist the latest client-side messages immediately so user messages are not
  // lost when the model call fails or is aborted.
  await chatRepository.saveMessages({
    messages: body.messages,
    threadId,
    userId,
  });

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

  const agent = await buildAgent();

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages,
    sendReasoning: true,
    sendSources: false,
    originalMessages: body.messages as never[],
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
