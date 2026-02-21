"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  FileIcon,
  FolderIcon,
  RefreshCwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { FileViewerDialog } from "@/components/chat/file-viewer-dialog";
import {
  FileEntryContextMenu,
  type FileEntry,
} from "@/components/chat/file-entry-context-menu";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadFile(path: string, fileName: string) {
  const a = document.createElement("a");
  a.href = `/api/files/${encodeURIComponent(path)}`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function deleteEntry(path: string): Promise<boolean> {
  const res = await fetch(`/api/files/${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  return res.ok;
}

// ─── Rename Dialog ────────────────────────────────────────────────────────────

interface RenameDialogProps {
  entry: FileEntry | null;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

function RenameDialog({ entry, onConfirm, onCancel }: RenameDialogProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry) {
      setValue(entry.name);
      // Select filename without extension for files
      setTimeout(() => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        const dotIdx = entry.isDirectory ? -1 : entry.name.lastIndexOf(".");
        inputRef.current.setSelectionRange(
          0,
          dotIdx > 0 ? dotIdx : entry.name.length,
        );
      }, 0);
    }
  }, [entry]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && trimmed !== entry?.name) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  }

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function WorkspaceFilesPanel() {
  const [currentDir, setCurrentDir] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState<FileEntry | null>(null);
  const [renameEntry, setRenameEntry] = useState<FileEntry | null>(null);

  const fetchEntries = useCallback(async (dir: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?dir=${encodeURIComponent(dir)}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(currentDir);
  }, [currentDir, fetchEntries]);

  const navigateUp = useCallback(() => {
    if (currentDir === "/") return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    setCurrentDir(parts.length > 0 ? parts.join("/") : "/");
  }, [currentDir]);

  // ─── Action handlers ──────────────────────────────────────────────────────

  function handleOpen(entry: FileEntry) {
    if (entry.isDirectory) {
      setCurrentDir(entry.path);
    } else {
      setViewerFile(entry);
    }
  }

  function handleDownload(entry: FileEntry) {
    downloadFile(entry.path, entry.name);
  }

  function handleAddToChat(_entry: FileEntry) {
    // TODO: implement add-to-chat
  }

  async function handleDelete(entry: FileEntry) {
    const ok = await deleteEntry(entry.path);
    if (ok) fetchEntries(currentDir);
  }

  function handleRenameRequest(entry: FileEntry) {
    setRenameEntry(entry);
  }

  async function handleRenameConfirm(newName: string) {
    if (!renameEntry) return;
    const ok = await renameEntryApi(renameEntry.path, newName);
    setRenameEntry(null);
    if (ok) fetchEntries(currentDir);
  }

  return (
    <>
      <Sidebar side="right" collapsible="offcanvas">
        <SidebarHeader className="border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateUp}
              disabled={currentDir === "/"}
              className="size-7 p-0"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>

            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              /{currentDir === "/" ? "" : currentDir}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchEntries(currentDir)}
              className="size-7 p-0"
            >
              <RefreshCwIcon className="size-4" />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {loading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading...
                </p>
              )}

              {!loading && entries.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No files found
                </p>
              )}

              {!loading && entries.length > 0 && (
                <SidebarMenu>
                  {entries.map((entry) => (
                    <SidebarMenuItem key={entry.path}>
                      <FileEntryContextMenu
                        entry={entry}
                        onOpen={handleOpen}
                        onDownload={handleDownload}
                        onAddToChat={handleAddToChat}
                        onDelete={handleDelete}
                        onRename={handleRenameRequest}
                      >
                        <SidebarMenuButton onClick={() => handleOpen(entry)}>
                          {entry.isDirectory ? (
                            <FolderIcon className="size-4" />
                          ) : (
                            <FileIcon className="size-4" />
                          )}
                          <span className="truncate">{entry.name}</span>
                          {!entry.isDirectory && (
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {formatBytes(entry.size)}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </FileEntryContextMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <FileViewerDialog
        open={viewerFile !== null}
        onOpenChange={(open) => !open && setViewerFile(null)}
        fileName={viewerFile?.name ?? ""}
        filePath={viewerFile?.path ?? ""}
      />

      <RenameDialog
        entry={renameEntry}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameEntry(null)}
      />
    </>
  );
}

async function renameEntryApi(path: string, newName: string): Promise<boolean> {
  const res = await fetch(`/api/files/${encodeURIComponent(path)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName }),
  });
  return res.ok;
}
