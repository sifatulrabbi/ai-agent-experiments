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
  readFileBuffer(filePath: string): Promise<Buffer>;
  mkdir(dirPath: string): Promise<void>;
  writeFile(filePath: string, content: string): Promise<void>;
  writeFileBuffer(
    filePath: string,
    content: Buffer | Uint8Array,
  ): Promise<void>;
  remove(fullPath: string): Promise<void>;
  /** Resolve a workspace-relative path to an absolute filesystem path. */
  resolve(filePath: string): string;
}
