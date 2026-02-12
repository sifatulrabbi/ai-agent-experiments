import { type FS, type FileStat, type FileEntry } from "./fs";
import { type DocxService } from "./docx";
import { type PptxService } from "./pptx";
import { type XlsxService } from "./xlsx";
import { type SubAgentService } from "./sub-agent";

/**
 * In-memory filesystem stub backed by a plain object.
 * Keys are absolute paths, values are file contents.
 */
export function createStubFs(files: Record<string, string> = {}): FS {
  const store = new Map<string, string>(Object.entries(files));

  return {
    async stat(filePath: string): Promise<FileStat> {
      const now = new Date().toISOString();
      // Check if it's an exact file
      if (store.has(filePath)) {
        const content = store.get(filePath)!;
        return {
          size: content.length,
          isDirectory: false,
          modified: now,
          created: now,
        };
      }
      // Check if it's a directory prefix
      const prefix = filePath.endsWith("/") ? filePath : filePath + "/";
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          return { size: 0, isDirectory: true, modified: now, created: now };
        }
      }
      throw new Error(`ENOENT: no such file or directory: ${filePath}`);
    },

    async readdir(dirPath: string): Promise<FileEntry[]> {
      const prefix = dirPath === "/" ? "/" : dirPath.replace(/\/$/, "") + "/";
      const seen = new Set<string>();
      const entries: FileEntry[] = [];

      for (const key of store.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const firstSegment = rest.split("/")[0];
        if (!firstSegment || seen.has(firstSegment)) continue;
        seen.add(firstSegment);

        // It's a directory if there's more after the first segment
        const isDirectory = rest.includes("/");
        entries.push({ name: firstSegment, isDirectory });
      }

      return entries;
    },

    async readFile(filePath: string): Promise<string> {
      const content = store.get(filePath);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory: ${filePath}`);
      }
      return content;
    },

    async mkdir(_dirPath: string): Promise<void> {
      // no-op for in-memory store
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      store.set(filePath, content);
    },
  };
}

export function createStubDocxService(): DocxService {
  return {
    async toMarkdown(_filePath: string): Promise<string> {
      return "<!-- p_1 -->\n# Document Title\n\n<!-- p_2 -->\nThis is sample document content.";
    },
    async toImages(_filePath: string): Promise<string[]> {
      return ["/tmp/converted-docx-files/sample/page-images/page-1.png"];
    },
    async modifyWithJson(
      _filePath: string,
      _modifications: unknown,
    ): Promise<void> {
      // no-op
    },
  };
}

export function createStubPptxService(): PptxService {
  return {
    async toMarkdown(_filePath: string): Promise<string> {
      return "<!-- slide_1 -->\n# Slide 1 Title\n\n<!-- el_1 -->\nBullet point content";
    },
    async toImages(_filePath: string): Promise<string[]> {
      return ["/tmp/converted-pptx-files/sample/slide-images/slide-1.png"];
    },
    async modifyWithJson(
      _filePath: string,
      _modifications: unknown,
    ): Promise<void> {
      // no-op
    },
  };
}

export function createStubXlsxService(): XlsxService {
  return {
    async toJsonl(_filePath: string) {
      return {
        workbook: {
          fileName: "sample.xlsx",
          sheetNames: ["Sheet1"],
          totalSheets: 1,
        },
        sheets: {
          Sheet1:
            '{"row":1,"A":"Name","B":"Value"}\n{"row":2,"A":"Item1","B":"100"}',
        },
      };
    },
    async modifyWithJsonl(
      _filePath: string,
      _modifications: Record<string, string>,
    ): Promise<void> {
      // no-op
    },
  };
}

export function createStubSubAgentService(): SubAgentService {
  return {
    async spawn(config) {
      return {
        output: `Sub-agent completed: ${config.goal}`,
        outputPath: undefined,
      };
    },
  };
}
