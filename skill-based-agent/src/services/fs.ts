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
}

// TODO:
