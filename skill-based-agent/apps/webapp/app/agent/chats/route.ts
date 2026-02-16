import { chatRepository } from "@/lib/server/chat-repository";
import { requireUserId } from "@/lib/server/auth-user";
import type { ReasoningBudget } from "@/components/chat/model-catalog";
import type { UIMessage } from "ai";
import { randomUUID } from "node:crypto";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    { threads: await chatRepository.listThreads(userId) },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : undefined;
  const initialUserMessage =
    typeof body?.initialUserMessage === "string" &&
    body.initialUserMessage.trim().length > 0
      ? body.initialUserMessage.trim()
      : undefined;
  const modelSelection =
    typeof body?.modelSelection?.providerId === "string" &&
    typeof body?.modelSelection?.modelId === "string" &&
    typeof body?.modelSelection?.reasoningBudget === "string"
      ? {
          providerId: body.modelSelection.providerId,
          modelId: body.modelSelection.modelId,
          reasoningBudget: body.modelSelection
            .reasoningBudget as ReasoningBudget,
        }
      : undefined;

  const messages: UIMessage[] = initialUserMessage
    ? [
        {
          id: randomUUID(),
          metadata: { pending: true },
          parts: [{ text: initialUserMessage, type: "text" }],
          role: "user",
        },
      ]
    : [];

  const thread = await chatRepository.createThread({
    messages,
    title,
    userId,
    modelSelection,
  });

  return Response.json({ thread }, { status: 201 });
}
