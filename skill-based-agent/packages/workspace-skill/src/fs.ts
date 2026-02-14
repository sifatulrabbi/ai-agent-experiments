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
import { type Logger } from "@protean/logger";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileStat {
  size: number;
  isDirectory: boolean;
  modified: string;
  created: string;
  totalLines: number;
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
export async function createLocalFs(
  rootPath: string,
  logger: Logger,
): Promise<FS> {
  const root = resolve(rootPath);

  logger.info("Initializing local workspace FS", { rootPath: root });

  await mkdir(root, { recursive: true });

  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(
      `Root path ${rootPath} is a file but requires a directory.`,
    );
  }

  return {
    stat: async (filePath) => {
      logger.debug("FS.stat", { filePath });
      try {
        const resolvedPath = resolveWithinRoot(root, filePath);
        const fileStat = await stat(resolvedPath);
        const content = await readFile(resolvedPath, "utf8");
        const lines = content.split("\n").length;
        return {
          isDirectory: fileStat.isDirectory(),
          size: fileStat.size,
          modified: fileStat.mtime.toISOString(),
          created: fileStat.birthtime.toISOString(),
          totalLines: lines,
        };
      } catch (error) {
        logger.error("FS.stat failed", { filePath, error });
        throw error;
      }
    },

    readdir: async (dirPath) => {
      logger.debug("FS.readdir", { dirPath });
      try {
        const resolvedPath = resolveWithinRoot(root, dirPath);
        const dirEntries = await readdir(resolvedPath, { withFileTypes: true });

        return dirEntries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
      } catch (error) {
        logger.error("FS.readdir failed", { dirPath, error });
        throw error;
      }
    },

    readFile: async (filePath) => {
      logger.debug("FS.readFile", { filePath });
      try {
        const resolvedPath = resolveWithinRoot(root, filePath);
        return readFile(resolvedPath, "utf8");
      } catch (error) {
        logger.error("FS.readFile failed", { filePath, error });
        throw error;
      }
    },

    mkdir: async (dirPath) => {
      logger.debug("FS.mkdir", { dirPath });
      try {
        const resolvedPath = resolveWithinRoot(root, dirPath);
        await mkdir(resolvedPath, { recursive: true });
      } catch (error) {
        logger.error("FS.mkdir failed", { dirPath, error });
        throw error;
      }
    },

    writeFile: async (filePath, content) => {
      logger.debug("FS.writeFile", { filePath, bytes: content.length });
      try {
        const resolvedPath = resolveWithinRoot(root, filePath);
        const parentPath = normalize(resolve(resolvedPath, ".."));
        const rel = relative(root, parentPath);
        const escapesRoot = rel.startsWith("..") || rel.includes(`..${sep}`);
        if (escapesRoot) {
          throw new Error(`Path "${filePath}" escapes workspace root.`);
        }

        await mkdir(parentPath, { recursive: true });
        await writeFile(resolvedPath, content, "utf8");
      } catch (error) {
        logger.error("FS.writeFile failed", { filePath, error });
        throw error;
      }
    },

    remove: async (fullPath) => {
      logger.debug("FS.remove", { fullPath });
      try {
        const resolvedPath = resolveWithinRoot(root, fullPath);
        if (await exists(resolvedPath)) {
          await unlink(resolvedPath);
        }
      } catch (error) {
        logger.error("FS.remove failed", { fullPath, error });
        throw error;
      }
    },
  };
}
