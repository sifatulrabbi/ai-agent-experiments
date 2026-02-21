"use client";

import { useCallback } from "react";
import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
} from "lucide-react";

import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactActions,
  ArtifactAction,
} from "@/components/ai-elements/artifact";
import { type DetectedFile, isImageExtension } from "@/lib/file-utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({
  extension,
  isDirectory,
}: {
  extension: string;
  isDirectory: boolean;
}) {
  if (isDirectory)
    return <FolderIcon className="size-4 shrink-0 text-muted-foreground" />;
  const ext = extension.toLowerCase();
  if (isImageExtension(ext))
    return <ImageIcon className="size-4 shrink-0 text-muted-foreground" />;
  if (ext === "csv" || ext === "xlsx")
    return (
      <FileSpreadsheetIcon className="size-4 shrink-0 text-muted-foreground" />
    );
  if (ext === "pptx")
    return (
      <PresentationIcon className="size-4 shrink-0 text-muted-foreground" />
    );
  if (["txt", "md", "json", "yaml", "yml", "html", "xml"].includes(ext))
    return <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />;
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}

function downloadFile(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

interface FileArtifactProps {
  file: DetectedFile;
}

export function FileArtifact({ file }: FileArtifactProps) {
  const handleDownload = useCallback(() => {
    downloadFile(file.serveUrl, file.name);
  }, [file.serveUrl, file.name]);

  return (
    <Artifact className="my-2 w-full">
      <ArtifactHeader>
        <div className="flex items-center gap-2 min-w-0">
          <FileTypeIcon
            extension={file.extension}
            isDirectory={file.isDirectory}
          />
          <div className="min-w-0">
            <ArtifactTitle className="truncate">{file.name}</ArtifactTitle>
            {file.sizeBytes != null && (
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.sizeBytes)}
              </p>
            )}
          </div>
        </div>
        {!file.isDirectory && (
          <ArtifactActions>
            <ArtifactAction
              tooltip="Download"
              icon={DownloadIcon}
              onClick={handleDownload}
            />
          </ArtifactActions>
        )}
      </ArtifactHeader>
    </Artifact>
  );
}
