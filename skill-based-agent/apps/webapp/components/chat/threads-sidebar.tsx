"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import type { ChatThread } from "@/lib/server/chat-repository";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarUserMenu } from "@/components/chat/sidebar-user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThreadApi } from "@/components/chat/use-thread-api";

interface ThreadsSidebarProps {
  threads: ChatThread[];
  userEmail?: string | null;
  userName?: string | null;
}

export function ThreadsSidebar({
  threads,
  userEmail,
  userName,
}: ThreadsSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { deleteThread } = useThreadApi();
  const [threadItems, setThreadItems] = useState(threads);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setThreadItems(threads);
  }, [threads]);

  const handleDelete = useCallback(
    async (threadId: string) => {
      setDeletingThreadId(threadId);

      try {
        const deleted = await deleteThread(threadId);

        if (!deleted) {
          return;
        }

        setThreadItems((current) =>
          current.filter((thread) => thread.id !== threadId),
        );

        startTransition(() => {
          if (pathname === `/chats/t/${threadId}`) {
            router.push("/chats/new");
          }

          router.refresh();
        });
      } finally {
        setDeletingThreadId(null);
      }
    },
    [deleteThread, pathname, router],
  );

  return (
    <aside className="hidden h-screen w-72 flex-col border-r bg-muted/20 p-3 md:flex">
      <Button asChild className="w-full justify-start" size="sm">
        <Link href="/chats/new">
          <PlusIcon className="size-4" />
          New chat
        </Link>
      </Button>

      <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
        <div className="space-y-1 pb-2">
          {threadItems.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground text-sm">
              No previous threads.
            </p>
          ) : (
            threadItems.map((thread) => {
              const isActive = pathname === `/chats/t/${thread.id}`;
              const isDeleting = deletingThreadId === thread.id;

              return (
                <div
                  className={`group flex items-start gap-1 rounded-md transition-colors ${
                    isActive ? "bg-accent" : "hover:bg-accent/70"
                  }`}
                  key={thread.id}
                >
                  <Link
                    className="block min-w-0 flex-1 rounded-md px-2 py-2"
                    href={`/chats/t/${thread.id}`}
                  >
                    <p className="truncate font-medium text-sm">
                      {thread.title.slice(0, 20)}
                      {thread.title.length > 20 ? "..." : ""}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {new Date(thread.updatedAt).toLocaleString()}
                    </p>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="mt-1.5 mr-1 h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-80 hover:opacity-100"
                        disabled={isDeleting}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          void handleDelete(thread.id);
                        }}
                        variant="destructive"
                      >
                        <Trash2Icon className="size-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                        }}
                      >
                        <ArchiveIcon className="size-4" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                        }}
                      >
                        <StarIcon className="size-4" />
                        Star
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="pt-3">
        <SidebarUserMenu userEmail={userEmail} userName={userName} />
      </div>
    </aside>
  );
}
