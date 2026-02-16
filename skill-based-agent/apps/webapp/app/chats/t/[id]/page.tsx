import { auth } from "@/auth";
import { ThreadRouteContent } from "@/components/chat/thread-route-content";
import { chatRepository } from "@/lib/server/chat-repository";
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

  const thread = await chatRepository.getThread(session.user.email, id);

  if (!thread) {
    notFound();
  }

  return (
    <ThreadRouteContent
      initialMessages={thread.messages}
      initialModelSelection={thread.modelSelection}
      initialThreadId={thread.id}
      initialTitle={thread.title}
    />
  );
}
