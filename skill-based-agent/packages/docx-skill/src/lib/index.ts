export { parseDocx, xmlParser, xmlBuilder } from "./docx-parser";
export { applyModifications } from "./docx-modifier";
export { docxToImages } from "./docx-to-images";
export type {
  DocxNode,
  DocxParagraph,
  DocxTable,
  DocxTableCell,
  DocxTableRow,
  DocxRun,
  ParsedDocx,
  XmlElementLocation,
  NumberingInfo,
} from "./types";
