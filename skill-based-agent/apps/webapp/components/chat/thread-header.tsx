"use client";

interface ThreadHeaderProps {
  activeThreadId: string | null;
  title?: string;
}

export function ThreadHeader({ activeThreadId, title }: ThreadHeaderProps) {
  const resolvedTitle = title || (activeThreadId ? "Chat" : "New chat");

  return (
    <header className="mb-2 border-b pb-3">
      <h1 className="font-semibold text-base tracking-tight">
        {resolvedTitle}
      </h1>
      <p className="text-muted-foreground text-xs">
        {activeThreadId ? `Thread: ${activeThreadId}` : "Draft conversation"}
      </p>
    </header>
  );
}
