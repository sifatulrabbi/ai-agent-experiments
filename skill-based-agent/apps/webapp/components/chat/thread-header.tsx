"use client";

import { useState } from "react";
import { FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThreadChatContext } from "@/components/chat/thread-chat-provider";
import { WorkspaceFilesPanel } from "@/components/chat/workspace-files-panel";

export function ThreadHeader() {
  const { activeThreadId: _ } = useThreadChatContext();
  const [filesPanelOpen, setFilesPanelOpen] = useState(false);

  return (
    <>
      {/* Mobile: fixed icon button alongside the sidebar hamburger */}
      <div className="fixed top-3 right-3 z-40 md:hidden">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setFilesPanelOpen(true)}
        >
          <FolderOpenIcon className="size-5" />
          <span className="sr-only">Files</span>
        </Button>
      </div>

      {/* Desktop: inline in the content flow */}
      <div className="hidden items-center justify-end px-4 py-2 md:flex">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setFilesPanelOpen(true)}
        >
          <FolderOpenIcon className="size-4" />
          Files
        </Button>
      </div>

      <WorkspaceFilesPanel
        open={filesPanelOpen}
        onOpenChange={setFilesPanelOpen}
      />
    </>
  );
}
