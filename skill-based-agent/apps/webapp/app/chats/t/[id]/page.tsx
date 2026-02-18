import { auth } from "@/auth";
import { ThreadRouteContent } from "@/components/chat/thread-route-content";
import { getAgentMemory } from "@/lib/server/agent-memory";
import {
  getDefaultModelSelection,
  getModelCatalog,
} from "@/lib/server/models/model-catalog";
import { normalizeThreadModelSelection } from "@/lib/server/models/model-selection";
import { canAccessThread, threadToUiMessages } from "@/lib/server/thread-utils";
import { notFound, redirect } from "next/navigation";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const memory = await getAgentMemory();
  const thread = await memory.getThread(id);
  if (!thread || !canAccessThread(thread, session.user.email)) {
    notFound();
  }

  const providers = getModelCatalog();
  const defaultModelSelection = getDefaultModelSelection();
  const initialModelSelection = normalizeThreadModelSelection({
    providerId: thread.modelSelection.providerId,
    modelId: thread.modelSelection.modelId,
    reasoningBudget: thread.modelSelection.reasoningBudget as
      | "none"
      | "low"
      | "medium"
      | "high",
  });

  return (
    <ThreadRouteContent
      defaultModelSelection={defaultModelSelection}
      initialMessages={threadToUiMessages(thread)}
      initialModelSelection={initialModelSelection}
      initialThreadId={thread.id}
      providers={providers}
    />
  );
}
