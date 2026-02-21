"use client";

import { FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useThreadChatContext } from "@/components/chat/thread-chat-provider";

export function ThreadHeader() {
  const { activeThreadId: _ } = useThreadChatContext();
  const { toggleSidebar } = useSidebar();

  return (
    <>
      {/* Mobile only: toggle button for the files sheet */}
      <div className="fixed top-3 right-3 z-40 md:hidden">
        <Button size="icon" variant="outline" onClick={toggleSidebar}>
          <FolderOpenIcon className="size-5" />
          <span className="sr-only">Files</span>
        </Button>
      </div>
    </>
  );
}
