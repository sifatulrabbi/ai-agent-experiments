import { auth } from "@/auth";
import { ThreadsSidebar } from "@/components/chat/threads-sidebar";
import { chatRepository } from "@/lib/server/chat-repository";
import { redirect } from "next/navigation";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user.email;

  if (!userEmail) {
    redirect("/login");
  }

  const threads = await chatRepository.listThreads(userEmail);

  return (
    <div className="flex min-h-screen">
      <ThreadsSidebar
        threads={threads}
        userEmail={session.user.email}
        userName={session.user.name}
      />

      <main className="min-w-0 flex-1">
        <div className="flex h-screen min-h-0 flex-col bg-background">
          <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col pt-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
