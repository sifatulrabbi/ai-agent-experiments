import { tool } from "ai";
import z from "zod";

import {
  type SkillDefinition,
  type SkillMetadata,
  renderSkillFrontmatter,
} from "./base";
import { type FS } from "../services/fs";
import { type PptxService } from "../services/pptx";
import {
  isValidPathLike,
  safeParseJson,
  toSafeBasename,
  toToolErrorPayload,
} from "../utils/tool-utils";

export interface PptxSkillDeps {
  fsClient: FS;
  pptxClient: PptxService;
}

export function createPptxSkill(
  deps: PptxSkillDeps,
): SkillDefinition<PptxSkillDeps> {
  const { fsClient, pptxClient } = deps;

  const PptxToMarkdown = tool({
    description:
      "Convert a PPTX file to Markdown with slide and element IDs embedded as markdown comments. Saves the output to /tmp/converted-pptx-files/{filename}/slides.md.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the PPTX file to convert."),
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
        const outputDir = `/tmp/converted-pptx-files/${toSafeBasename(filePath)}`;
        await fsClient.mkdir(outputDir);

        const content = await pptxClient.toMarkdown(filePath);
        const outputPath = `${outputDir}/slides.md`;
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

  const PptxToImages = tool({
    description:
      "Convert all slides of a PPTX file into images. Saves images to /tmp/converted-pptx-files/{filename}/slide-images/.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the PPTX file to convert."),
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
        const outputDir = `/tmp/converted-pptx-files/${toSafeBasename(filePath)}/slide-images`;
        await fsClient.mkdir(outputDir);

        const slides = await pptxClient.toImages(filePath);

        return { sourcePath: filePath, outputDir, slides, status: "ok" };
      } catch (error) {
        return {
          sourcePath: filePath,
          status: "error",
          error: toToolErrorPayload(error),
        };
      }
    },
  });

  const ModifyPptxWithJson = tool({
    description:
      "Apply JSON-based modifications to a PPTX file. The modifications string should be valid JSON describing the changes to make.",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the PPTX file to modify."),
      modifications: z
        .string()
        .describe(
          "JSON string describing the modifications to apply to the presentation.",
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
        "ModifyPptxWithJson.modifications",
      );
      if (!parsed.ok) {
        return {
          sourcePath: filePath,
          status: "error",
          error: { code: parsed.error.code, message: parsed.error.message },
        };
      }

      try {
        await pptxClient.modifyWithJson(filePath, parsed.value);

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
    id: "pptx-skill",
    version: "1.0.0",
    description:
      "Read, understand, and modify PowerPoint (.pptx) presentations. Converts slides to Markdown for comprehension and applies changes via structured JSON.",
    useWhen:
      "The user shares a .pptx file, asks to read/edit/create a presentation, or any task involving slide decks (pitch decks, training materials, status updates).",
    toolNames: ["PptxToMarkdown", "PptxToImages", "ModifyPptxWithJson"],
    dependencies: ["workspace-skill"],
  };

  const pptxSkill: SkillDefinition<PptxSkillDeps> = {
    id: metadata.id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `# PPTX Skill

You have access to tools for working with PowerPoint (PPTX) presentations.

## Recommended Workflow

1. **PptxToMarkdown** - Start by converting the PPTX to Markdown. This gives you a text representation of every slide with element IDs embedded as markdown comments (\`<!-- p_123 -->\`). Use these IDs when building modifications.
2. **PptxToImages** (optional) - Convert slides to images for visual reasoning. Useful when layout, positioning, or visual appearance matters.
3. **Gather information** - Use workspace tools to read reference materials, brand guidelines, or data sources needed for the edits.
4. **Build modifications** - Construct a JSON object describing the changes. Reference element IDs from the Markdown output.
5. **ModifyPptxWithJson** - Apply the JSON modifications to update the presentation.

## Available Tools

### PptxToMarkdown
Converts a PPTX file into Markdown with slide and element IDs embedded as comments.
Output is saved to \`/tmp/converted-pptx-files/{filename}/slides.md\`.
Always run this first to understand the structure of the presentation.

### PptxToImages
Converts all slides into PNG images for visual inspection.
Output is saved to \`/tmp/converted-pptx-files/{filename}/slide-images/\`.
Use this when you need to reason about visual layout, colors, or positioning.

### ModifyPptxWithJson
Applies JSON-based modifications to the PPTX file.
The modifications parameter must be a valid JSON string.
Use element IDs from PptxToMarkdown output to target specific elements.

## Guidelines

- Always convert to Markdown first to understand slide structure before making changes.
- Use element IDs from the Markdown comments to precisely target modifications.
- When visual context matters, convert to images as well.
- Validate your JSON modifications string before applying.`,
    tools: {
      PptxToMarkdown,
      PptxToImages,
      ModifyPptxWithJson,
    },
    dependencies: deps,
  };

  return pptxSkill;
}
