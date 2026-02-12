export interface PptxService {
  toMarkdown(filePath: string): Promise<string>;
  toImages(filePath: string): Promise<string[]>;
  modifyWithJson(filePath: string, modifications: unknown): Promise<void>;
}

// TODO:
