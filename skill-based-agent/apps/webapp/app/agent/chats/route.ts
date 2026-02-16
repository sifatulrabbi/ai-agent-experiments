import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import { requireUserId } from "@/lib/server/auth-user";
import { chatRepository } from "@/lib/server/chat-repository";
import {
  normalizeThreadModelSelection,
  parseStrictModelSelection,
} from "@/lib/server/models/model-selection";

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
  const [userId, body] = await Promise.all([
    requireUserId(),
    request.json().catch(() => ({})),
  ]);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const title = typeof body?.title === "string" ? body.title : undefined;
  const initialUserMessage =
    typeof body?.initialUserMessage === "string" &&
    body.initialUserMessage.trim().length > 0
      ? body.initialUserMessage.trim()
      : undefined;

  const modelSelection = normalizeThreadModelSelection(
    parseStrictModelSelection(body?.modelSelection),
  );

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
