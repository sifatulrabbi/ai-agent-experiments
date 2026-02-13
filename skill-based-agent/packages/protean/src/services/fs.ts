import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
  unlink,
  exists,
} from "fs/promises";
import { resolve, relative, sep, normalize } from "path";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileStat {
  size: number;
  isDirectory: boolean;
  modified: string;
  created: string;
}

export interface FS {
  stat(filePath: string): Promise<FileStat>;
  readdir(dirPath: string): Promise<FileEntry[]>;
  readFile(filePath: string): Promise<string>;
  mkdir(dirPath: string): Promise<void>;
  writeFile(filePath: string, content: string): Promise<void>;
  remove(fullPath: string): Promise<void>;
}

function resolveWithinRoot(root: string, inputPath: string): string {
  const sanitized = inputPath.trim();
  const relativeInput = sanitized.startsWith("/")
    ? sanitized.slice(1)
    : sanitized;
  const candidate = resolve(root, relativeInput);
  const rel = relative(root, candidate);
  const escapesRoot = rel.startsWith("..") || rel.includes(`..${sep}`);

  if (escapesRoot) {
    throw new Error(`Path "${inputPath}" escapes workspace root.`);
  }

  return candidate;
}

// Root path: /Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project/
export async function createFS(rootPath: string): Promise<FS> {
  const root = resolve(rootPath);

  await mkdir(root, { recursive: true });

  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(
      `Root path ${rootPath} is a file but requires a directory.`,
    );
  }

  return {
    stat: async (filePath) => {
      const resolvedPath = resolveWithinRoot(root, filePath);
      const fileStat = await stat(resolvedPath);
      return {
        isDirectory: fileStat.isDirectory(),
        size: fileStat.size,
        modified: fileStat.mtime.toISOString(),
        created: fileStat.birthtime.toISOString(),
      };
    },

    readdir: async (dirPath) => {
      const resolvedPath = resolveWithinRoot(root, dirPath);
      const dirEntries = await readdir(resolvedPath, { withFileTypes: true });

      return dirEntries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }));
    },

    readFile: async (filePath) => {
      const resolvedPath = resolveWithinRoot(root, filePath);
      return readFile(resolvedPath, "utf8");
    },

    mkdir: async (dirPath) => {
      const resolvedPath = resolveWithinRoot(root, dirPath);
      await mkdir(resolvedPath, { recursive: true });
    },

    writeFile: async (filePath, content) => {
      const resolvedPath = resolveWithinRoot(root, filePath);
      const parentPath = normalize(resolve(resolvedPath, ".."));
      const rel = relative(root, parentPath);
      const escapesRoot = rel.startsWith("..") || rel.includes(`..${sep}`);
      if (escapesRoot) {
        throw new Error(`Path "${filePath}" escapes workspace root.`);
      }

      await mkdir(parentPath, { recursive: true });
      await writeFile(resolvedPath, content, "utf8");
    },

    remove: async (fullPath) => {
      const resolvedPath = resolveWithinRoot(root, fullPath);
      if (await exists(resolvedPath)) {
        await unlink(resolvedPath);
      }
    },
  };
}
