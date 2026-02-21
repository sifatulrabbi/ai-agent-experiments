"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  RefreshCwIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { FileViewerDialog } from "@/components/chat/file-viewer-dialog";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

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

interface WorkspaceFilesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceFilesPanel({
  open,
  onOpenChange,
}: WorkspaceFilesPanelProps) {
  const [currentDir, setCurrentDir] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState<{
    name: string;
    path: string;
  } | null>(null);

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
    if (open) {
      fetchEntries(currentDir);
    }
  }, [open, currentDir, fetchEntries]);

  const navigateUp = useCallback(() => {
    if (currentDir === "/") return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    setCurrentDir(parts.length > 0 ? parts.join("/") : "/");
  }, [currentDir]);

  const navigateInto = useCallback((entry: FileEntry) => {
    if (!entry.isDirectory) return;
    setCurrentDir(entry.path);
  }, []);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Workspace Files</SheetTitle>
            <SheetDescription className="sr-only">
              Browse files in your workspace
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 border-b px-4 pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateUp}
              disabled={currentDir === "/"}
              className="size-8 p-0"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>

            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground font-mono">
              /{currentDir === "/" ? "" : currentDir}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchEntries(currentDir)}
              className="size-8 p-0"
            >
              <RefreshCwIcon className="size-4" />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1">
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

            {!loading &&
              entries.map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  {entry.isDirectory ? (
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}

                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() =>
                      entry.isDirectory
                        ? navigateInto(entry)
                        : setViewerFile({
                            name: entry.name,
                            path: entry.path,
                          })
                    }
                  >
                    {entry.name}
                  </button>

                  {!entry.isDirectory && (
                    <>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(entry.size)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => downloadFile(entry.path, entry.name)}
                      >
                        <DownloadIcon className="size-3.5" />
                        <span className="sr-only">Download {entry.name}</span>
                      </Button>
                    </>
                  )}
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <FileViewerDialog
        open={viewerFile !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setViewerFile(null);
        }}
        fileName={viewerFile?.name ?? ""}
        filePath={viewerFile?.path ?? ""}
      />
    </>
  );
}
