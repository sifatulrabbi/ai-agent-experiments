import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth-user";
import { resolveWithinRoot } from "@protean/vfs";
import { readFile, stat, rm, rename } from "fs/promises";
import { join, dirname } from "path";

const WORKSPACE_BASE =
  "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project";

const MIME_MAP: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  yaml: "text/yaml",
  yml: "text/yaml",
  xml: "text/xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const filePath = decodeURIComponent(pathSegments.join("/"));
  const workspaceRoot = `${WORKSPACE_BASE}/${userId}`;

  let resolvedPath: string;
  try {
    resolvedPath = resolveWithinRoot(workspaceRoot, filePath);
  } catch {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolvedPath);
    if (fileStat.isDirectory()) {
      return NextResponse.json(
        { error: "Cannot serve a directory" },
        { status: 400 },
      );
    }

    const buffer = await readFile(resolvedPath);
    const mimeType = getMimeType(resolvedPath);
    const fileName = resolvedPath.split("/").pop() ?? "file";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const filePath = decodeURIComponent(pathSegments.join("/"));
  const workspaceRoot = `${WORKSPACE_BASE}/${userId}`;

  let resolvedPath: string;
  try {
    resolvedPath = resolveWithinRoot(workspaceRoot, filePath);
  } catch {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  try {
    await rm(resolvedPath, { recursive: true, force: false });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const filePath = decodeURIComponent(pathSegments.join("/"));
  const workspaceRoot = `${WORKSPACE_BASE}/${userId}`;

  let resolvedPath: string;
  try {
    resolvedPath = resolveWithinRoot(workspaceRoot, filePath);
  } catch {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  let newName: string;
  try {
    const body = await request.json();
    newName = String(body.newName ?? "").trim();
    if (!newName || newName.includes("/") || newName.includes("\\")) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const newPath = join(dirname(resolvedPath), newName);
  try {
    resolveWithinRoot(workspaceRoot, newPath);
  } catch {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  try {
    await rename(resolvedPath, newPath);
    return NextResponse.json({ renamed: true, newName });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to rename" }, { status: 500 });
  }
}
