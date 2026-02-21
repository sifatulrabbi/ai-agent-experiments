import type { UIMessage } from "ai";

import { requireUserId } from "@/lib/server/auth-user";
import { getAgentMemory } from "@/lib/server/agent-memory";
import { canAccessThread } from "@/lib/server/thread-utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string; messageId: string }> },
) {
  const [userId, body] = await Promise.all([
    requireUserId(),
    request.json().catch(() => null),
  ]);

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body?.message) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { threadId, messageId } = await params;
  const memory = await getAgentMemory();
  let thread = await memory.getThreadWithMessages(threadId);

  if (!thread || !canAccessThread(thread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  const message = body.message as UIMessage;
  const existingRecord = thread.history.find(
    (record) => record.deletedAt === null && record.message.id === messageId,
  );

  if (!existingRecord || existingRecord.message.role !== "user") {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  thread = await memory.upsertMessage(threadId, {
    id: existingRecord.id,
    message,
    modelSelection: thread.modelSelection,
    usage: existingRecord.usage,
  });

  if (!thread || !canAccessThread(thread, userId)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread }, { status: 200 });
}
