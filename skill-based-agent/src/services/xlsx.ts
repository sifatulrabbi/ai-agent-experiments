export interface WorkbookInfo {
  fileName: string;
  sheetNames: string[];
  totalSheets: number;
}

export interface XlsxService {
  toJsonl(
    filePath: string,
  ): Promise<{ workbook: WorkbookInfo; sheets: Record<string, string> }>;
  modifyWithJsonl(
    filePath: string,
    modifications: Record<string, string>,
  ): Promise<void>;
}
