import { requireUserId } from "@/lib/server/auth-user";
import { getAgentMemory } from "@/lib/server/agent-memory";
import {
  normalizeThreadModelSelection,
  parseStrictModelSelection,
} from "@/lib/server/models/model-selection";
import { canAccessThread } from "@/lib/server/thread-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const memory = await getAgentMemory();
  const thread = await memory.getThread(id);
  if (!thread || !canAccessThread(thread, userId)) {
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
  const memory = await getAgentMemory();
  const thread = await memory.getThread(id);
  if (!thread || !canAccessThread(thread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  const deleted = await memory.softDeleteThread(id);

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
  const memory = await getAgentMemory();
  const existing = await memory.getThread(id);
  if (!existing || !canAccessThread(existing, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const thread = await memory.updateThreadSettings(id, {
    modelSelection: normalizeThreadModelSelection(modelSelection),
  });

  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread }, { status: 200 });
}
