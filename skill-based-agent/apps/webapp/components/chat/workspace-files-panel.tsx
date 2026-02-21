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
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
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

export function WorkspaceFilesPanel() {
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
    fetchEntries(currentDir);
  }, [currentDir, fetchEntries]);

  const navigateUp = useCallback(() => {
    if (currentDir === "/") return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    setCurrentDir(parts.length > 0 ? parts.join("/") : "/");
  }, [currentDir]);

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
                      <SidebarMenuButton
                        onClick={() =>
                          entry.isDirectory
                            ? setCurrentDir(entry.path)
                            : setViewerFile({
                                name: entry.name,
                                path: entry.path,
                              })
                        }
                      >
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

                      {!entry.isDirectory && (
                        <SidebarMenuAction
                          onClick={() => downloadFile(entry.path, entry.name)}
                        >
                          <DownloadIcon className="size-3.5" />
                          <span className="sr-only">Download {entry.name}</span>
                        </SidebarMenuAction>
                      )}
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
        onOpenChange={(open) => {
          if (!open) setViewerFile(null);
        }}
        fileName={viewerFile?.name ?? ""}
        filePath={viewerFile?.path ?? ""}
      />
    </>
  );
}
