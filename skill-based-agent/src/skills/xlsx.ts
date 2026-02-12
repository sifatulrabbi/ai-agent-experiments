import { tool } from "ai";
import z from "zod";

import {
  type SkillDefinition,
  type SkillMetadata,
  renderSkillFrontmatter,
} from "./base";
import { type FS } from "../services/fs";
import { type XlsxService } from "../services/xlsx";
import {
  isValidPathLike,
  safeParseJson,
  toSafeBasename,
  toToolErrorPayload,
} from "../utils/tool-utils";

export interface XlsxSkillDeps {
  fsClient: FS;
  xlsxClient: XlsxService;
}

export function createXlsxSkill(
  deps: XlsxSkillDeps,
): SkillDefinition<XlsxSkillDeps> {
  const { fsClient, xlsxClient } = deps;

  const XlsxToJsonl = tool({
    description:
      "Read an XLSX file and convert it to JSONL format, preserving formulas. Each sheet is written as a separate .jsonl file alongside a workbook.json manifest.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the .xlsx file to convert."),
    }),
    execute: async ({ filePath }) => {
      if (!isValidPathLike(filePath)) {
        return {
          sourcePath: filePath,
          status: "error",
          error: {
            code: "INVALID_PATH",
            message: "filePath must be a non-empty path",
          },
        };
      }

      try {
        const result = await xlsxClient.toJsonl(filePath);
        const outputDir = `/tmp/converted-xlsx-files/${toSafeBasename(filePath)}`;
        const sheetsDir = `${outputDir}/sheets`;

        await fsClient.mkdir(sheetsDir);
        await fsClient.writeFile(
          `${outputDir}/workbook.json`,
          JSON.stringify(result.workbook, null, 2),
        );

        for (const [sheetName, jsonlContent] of Object.entries(result.sheets)) {
          await fsClient.writeFile(
            `${sheetsDir}/${sheetName}.jsonl`,
            jsonlContent,
          );
        }

        return {
          sourcePath: filePath,
          outputDir,
          outputPath: `${outputDir}/workbook.json`,
          workbook: result.workbook,
          status: "ok",
        };
      } catch (error) {
        return {
          sourcePath: filePath,
          status: "error",
          error: toToolErrorPayload(error),
        };
      }
    },
  });

  const ModifyXlsxWithJsonl = tool({
    description:
      "Update an XLSX file with JSONL modifications. The modifications string should be a JSON object mapping sheet names to their JSONL content.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the .xlsx file to modify."),
      modifications: z
        .string()
        .describe(
          "JSON-stringified Record<string, string> mapping sheet names to JSONL content with the desired changes.",
        ),
    }),
    execute: async ({ filePath, modifications }) => {
      if (!isValidPathLike(filePath)) {
        return {
          sourcePath: filePath,
          status: "error",
          error: {
            code: "INVALID_PATH",
            message: "filePath must be a non-empty path",
          },
        };
      }

      const parsed = safeParseJson<Record<string, string>>(
        modifications,
        "ModifyXlsxWithJsonl.modifications",
      );
      if (!parsed.ok) {
        return {
          sourcePath: filePath,
          status: "error",
          error: { code: parsed.error.code, message: parsed.error.message },
        };
      }

      try {
        await xlsxClient.modifyWithJsonl(filePath, parsed.value);
        return { sourcePath: filePath, status: "ok", modified: true };
      } catch (error) {
        return {
          sourcePath: filePath,
          status: "error",
          error: toToolErrorPayload(error),
        };
      }
    },
  });

  const metadata: SkillMetadata = {
    id: "xlsx-skill",
    version: "1.0.0",
    description:
      "Read, understand, and modify Excel (.xlsx) workbooks. Converts sheets to JSONL for comprehension and applies changes back via JSONL.",
    useWhen:
      "The user shares a .xlsx file, asks to read/edit/create a spreadsheet, or any task involving tabular data, financial models, or workbook analysis.",
    toolNames: ["XlsxToJsonl", "ModifyXlsxWithJsonl"],
    dependencies: ["workspace-skill"],
  };

  const xlsxSkill: SkillDefinition<XlsxSkillDeps> = {
    id: metadata.id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `# XLSX Skill

You can read and modify Excel (.xlsx) workbooks using a two-step JSONL workflow.

## Available Tools

### XlsxToJsonl
Converts an XLSX file into JSONL. The output is written to a temporary directory:
\`\`\`
/tmp/converted-xlsx-files/{filename}/
    workbook.json          # WorkbookInfo manifest (fileName, sheetNames, totalSheets)
    sheets/
        SheetName.jsonl    # One file per sheet
\`\`\`
Use this first to understand the structure and content of a workbook.

### ModifyXlsxWithJsonl
Applies JSONL modifications back to an XLSX file. Pass a JSON-stringified object mapping sheet names to their updated JSONL content.

## Recommended Workflow

1. **Convert** - Call XlsxToJsonl to extract the workbook into JSONL files.
2. **Understand** - Read the workbook.json manifest and individual sheet JSONL files to understand the data layout, column headers, and any formulas.
3. **Gather context** - Use workspace tools to collect any additional information needed to decide what changes to make.
4. **Prepare modifications** - Write the updated JSONL content for each sheet that needs changes.
5. **Apply** - Call ModifyXlsxWithJsonl with the file path and a JSON-stringified modifications object to write the changes back.

## Guidelines

- Always convert and read the workbook before attempting modifications.
- Preserve existing formulas unless the user explicitly asks to change them.
- Only include sheets that need changes in the modifications object.
- Validate your JSONL content is well-formed before calling ModifyXlsxWithJsonl.`,
    tools: {
      XlsxToJsonl,
      ModifyXlsxWithJsonl,
    },
    dependencies: deps,
  };

  return xlsxSkill;
}
