import { tool } from "ai";
import z from "zod";

import {
  type SkillDefinition,
  type SkillMetadata,
  renderSkillFrontmatter,
} from "./base";
import { type FS } from "../services/fs";
import { type DocxService } from "../services/docx";
import {
  isValidPathLike,
  safeParseJson,
  toSafeBasename,
  toToolErrorPayload,
} from "../utils/tool-utils";

export interface DocxSkillDeps {
  fsClient: FS;
  docxClient: DocxService;
}

export function createDocxSkill(
  deps: DocxSkillDeps,
): SkillDefinition<DocxSkillDeps> {
  const { fsClient, docxClient } = deps;

  const DocxToMarkdown = tool({
    description:
      "Reads a DOCX file and converts it to Markdown with element IDs embedded as markdown comments (<!-- p_123 -->). Saves the converted content to /tmp/converted-docx-files/{filename}/content.md.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the DOCX file to convert."),
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
        const content = await docxClient.toMarkdown(filePath);
        const outputDir = `/tmp/converted-docx-files/${toSafeBasename(filePath)}`;
        await fsClient.mkdir(outputDir);
        const outputPath = `${outputDir}/content.md`;
        await fsClient.writeFile(outputPath, content);

        return { sourcePath: filePath, outputPath, content, status: "ok" };
      } catch (error) {
        return {
          sourcePath: filePath,
          status: "error",
          error: toToolErrorPayload(error),
        };
      }
    },
  });

  const DocxToImages = tool({
    description:
      "Converts all pages of a DOCX file into images. Saves page images to /tmp/converted-docx-files/{filename}/page-images/.",
    inputSchema: z.object({
      filePath: z
        .string()
        .describe("Path to the DOCX file to convert to images."),
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
        const pages = await docxClient.toImages(filePath);
        const outputDir = `/tmp/converted-docx-files/${toSafeBasename(filePath)}/page-images`;
        await fsClient.mkdir(outputDir);
        return { sourcePath: filePath, outputDir, pages, status: "ok" };
      } catch (error) {
        return {
          sourcePath: filePath,
          status: "error",
          error: toToolErrorPayload(error),
        };
      }
    },
  });

  const ModifyDocxWithJson = tool({
    description:
      "Updates a DOCX file with JSON modifications. The modifications string must be valid JSON describing the changes to apply.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the DOCX file to modify."),
      modifications: z
        .string()
        .describe(
          "JSON-stringified modifications object describing the changes to apply to the document.",
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

      const parsed = safeParseJson<unknown>(
        modifications,
        "ModifyDocxWithJson.modifications",
      );
      if (!parsed.ok) {
        return {
          sourcePath: filePath,
          status: "error",
          error: { code: parsed.error.code, message: parsed.error.message },
        };
      }

      try {
        await docxClient.modifyWithJson(filePath, parsed.value);
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
    id: "docx-skill",
    version: "1.0.0",
    description:
      "Read, understand, and modify Word (.docx) documents. Converts documents to Markdown for comprehension and applies changes via structured JSON.",
    useWhen:
      "The user shares a .docx file, asks to read/edit/create a Word document, or any task involving DOCX content (proposals, reports, contracts, letters).",
    toolNames: ["DocxToMarkdown", "DocxToImages", "ModifyDocxWithJson"],
    dependencies: ["workspace-skill"],
  };

  const docxSkill: SkillDefinition<DocxSkillDeps> = {
    id: metadata.id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `# DOCX Skill

You have access to tools for reading, converting, and modifying DOCX documents.

## Recommended Workflow

1. **Convert to Markdown** - Use DocxToMarkdown to convert the DOCX file into Markdown with embedded element IDs. This gives you a readable representation of the document and the IDs needed for targeted modifications.
2. **Visual Reasoning (optional)** - Use DocxToImages to render all pages as images. This is useful when layout, formatting, or visual context matters for understanding the document.
3. **Gather Context** - Use workspace and library tools to collect any reference material, templates, or data needed for your modifications.
4. **Prepare Modifications** - Write a JSON modifications object that references element IDs from the Markdown output. Stringify the JSON before passing it to the tool.
5. **Apply Changes** - Use ModifyDocxWithJson to apply the modifications to the original DOCX file.

## Available Tools

### DocxToMarkdown
Converts a DOCX file to Markdown with element IDs embedded as HTML comments (\`<!-- p_123 -->\`).
The converted content is saved to \`/tmp/converted-docx-files/{filename}/content.md\`.
Returns the source path, output path, and the Markdown content.

### DocxToImages
Converts all pages of a DOCX file into images.
Images are saved to \`/tmp/converted-docx-files/{filename}/page-images/\`.
Returns the source path, output directory, and a list of page image paths.

### ModifyDocxWithJson
Applies JSON-described modifications to a DOCX file.
The \`modifications\` parameter must be a JSON string. Parse element IDs from the Markdown conversion to target specific elements.

## Guidelines

- Always convert to Markdown first to understand document structure and obtain element IDs.
- Use DocxToImages when visual layout context is important for making correct modifications.
- Validate your JSON modifications string before calling ModifyDocxWithJson.
- Reference element IDs from the Markdown output when targeting specific paragraphs or elements.`,
    tools: {
      DocxToMarkdown,
      DocxToImages,
      ModifyDocxWithJson,
    },
    dependencies: deps,
  };

  return docxSkill;
}
