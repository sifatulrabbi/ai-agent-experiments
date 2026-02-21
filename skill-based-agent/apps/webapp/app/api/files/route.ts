import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/auth-user";
import { resolveWithinRoot } from "@protean/vfs";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const WORKSPACE_BASE =
  "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project";

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dir = request.nextUrl.searchParams.get("dir") ?? "/";
  const workspaceRoot = `${WORKSPACE_BASE}/${userId}`;

  let resolvedDir: string;
  try {
    resolvedDir = resolveWithinRoot(workspaceRoot, dir);
  } catch {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  try {
    const dirEntries = await readdir(resolvedDir, { withFileTypes: true });

    const entries = await Promise.all(
      dirEntries.map(async (entry) => {
        const entryPath = join(resolvedDir, entry.name);
        const relativePath = dir === "/" ? entry.name : `${dir}/${entry.name}`;
        try {
          const entryStat = await stat(entryPath);
          return {
            name: entry.name,
            path: relativePath,
            isDirectory: entry.isDirectory(),
            size: entryStat.size,
            modified: entryStat.mtime.toISOString(),
          };
        } catch {
          return {
            name: entry.name,
            path: relativePath,
            isDirectory: entry.isDirectory(),
            size: 0,
            modified: new Date().toISOString(),
          };
        }
      }),
    );

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      { entries, dir },
      {
        headers: { "Cache-Control": "private, no-cache" },
      },
    );
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ entries: [], dir });
    }
    return NextResponse.json(
      { error: "Failed to list directory" },
      { status: 500 },
    );
  }
}
