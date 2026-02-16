import { requireUserId } from "@/lib/server/auth-user";
import { chatRepository } from "@/lib/server/chat-repository";
import {
  normalizeThreadModelSelection,
  parseStrictModelSelection,
} from "@/lib/server/models/model-selection";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const thread = await chatRepository.getThread(userId, id);

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await chatRepository.deleteThread(userId, id);

  if (!deleted) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ ok: true }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [userId, body] = await Promise.all([
    requireUserId(),
    request.json().catch(() => null),
  ]);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modelSelection = parseStrictModelSelection(body?.modelSelection);

  if (!modelSelection) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await params;
  const thread = await chatRepository.updateThreadSettings({
    modelSelection: normalizeThreadModelSelection(modelSelection),
    threadId: id,
    userId,
  });

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread }, { status: 200 });
}
