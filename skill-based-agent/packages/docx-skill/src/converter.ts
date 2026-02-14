import { type Logger } from "@protean/logger";
import { type FS } from "@protean/vfs";

export interface DocxConvertResult {
  markdownPath: string;
  outputDir: string;
}

export interface DocxImagesToResult {
  imageDir: string;
  pages: string[];
  outputDir: string;
}

export interface DocxModification {
  elementId: string;
  action: "replace" | "delete" | "insertAfter" | "insertBefore";
  content?: string;
}

export interface DocxConverter {
  toMarkdown(docxPath: string): Promise<DocxConvertResult>;
  toImages(docxPath: string): Promise<DocxImagesToResult>;
  modify(
    docxPath: string,
    modifications: DocxModification[],
  ): Promise<{ outputPath: string }>;
}

export function createStubDocxConverter(
  _fsClient: FS,
  _outputDir: string,
  _logger: Logger,
): DocxConverter {
  return {
    toMarkdown: async () => {
      throw new Error("DocxConverter.toMarkdown is not implemented");
    },
    toImages: async () => {
      throw new Error("DocxConverter.toImages is not implemented");
    },
    modify: async () => {
      throw new Error("DocxConverter.modify is not implemented");
    },
  };
}
