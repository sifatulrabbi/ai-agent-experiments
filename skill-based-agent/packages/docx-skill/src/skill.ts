import { tool } from "ai";
import { z } from "zod";
import { Skill } from "@protean/skill";
import { type Logger } from "@protean/logger";
import { tryCatch } from "@protean/utils";
import { type FS } from "@protean/vfs";

import { type DocxConverter } from "./converter";
import { docxSkillDescription, docxSkillInstructions } from "./instructions";

export interface DocxSkillDeps {
  fsClient: FS;
  converter: DocxConverter;
  logger: Logger;
  outputDir?: string;
}

const DEFAULT_OUTPUT_DIR = "/tmp/converted-docx-files/";

export class DocxSkill extends Skill<DocxSkillDeps> {
  constructor(dependencies: DocxSkillDeps) {
    super(
      {
        id: "docx-skill",
        description: docxSkillDescription,
        instructions: docxSkillInstructions,
        dependencies,
      },
      dependencies.logger,
    );
  }

  get tools() {
    return {
      DocxToMarkdown: this.DocxToMarkdown,
      DocxToImages: this.DocxToImages,
      ModifyDocxWithJson: this.ModifyDocxWithJson,
    };
  }

  DocxToMarkdown = tool({
    description:
      "Convert a DOCX file to Markdown with element IDs (<!-- p_123 -->) for referencing in modifications.",
    inputSchema: z.object({
      docxPath: z.string().describe("Path to the DOCX file to convert."),
    }),
    execute: async ({ docxPath }) => {
      this.logger.debug('Running docx operation "DocxToMarkdown"', {
        path: docxPath,
      });
      const { result, error } = await tryCatch(() =>
        this.dependencies.converter.toMarkdown(docxPath),
      );
      if (error) {
        this.logger.error('Docx operation "DocxToMarkdown" failed', {
          path: docxPath,
          error,
        });
        return {
          error: `Docx operation "DocxToMarkdown" failed for path "${docxPath}": ${error.message || "Unknown error"}`,
          docxPath,
        };
      }

      return { error: null, docxPath, ...result };
    },
  });

  DocxToImages = tool({
    description:
      "Convert all pages of a DOCX file to PNG images for visual inspection.",
    inputSchema: z.object({
      docxPath: z.string().describe("Path to the DOCX file to convert."),
    }),
    execute: async ({ docxPath }) => {
      this.logger.debug('Running docx operation "DocxToImages"', {
        path: docxPath,
      });
      const { result, error } = await tryCatch(() =>
        this.dependencies.converter.toImages(docxPath),
      );
      if (error) {
        this.logger.error('Docx operation "DocxToImages" failed', {
          path: docxPath,
          error,
        });
        return {
          error: `Docx operation "DocxToImages" failed for path "${docxPath}": ${error.message || "Unknown error"}`,
          docxPath,
        };
      }

      return { error: null, docxPath, ...result };
    },
  });

  ModifyDocxWithJson = tool({
    description:
      "Apply JSON modifications to a DOCX file. Each modification references an element ID and specifies an action.",
    inputSchema: z.object({
      docxPath: z.string().describe("Path to the DOCX file to modify."),
      modifications: z
        .array(
          z.object({
            elementId: z
              .string()
              .describe('Element ID from Markdown output (e.g., "p_123").'),
            action: z
              .enum(["replace", "delete", "insertAfter", "insertBefore"])
              .describe("The modification action to perform."),
            content: z
              .string()
              .optional()
              .describe(
                "New content for replace/insert actions. Not needed for delete.",
              ),
          }),
        )
        .describe("Array of modifications to apply."),
    }),
    execute: async ({ docxPath, modifications }) => {
      this.logger.debug('Running docx operation "ModifyDocxWithJson"', {
        path: docxPath,
        modificationCount: modifications.length,
      });
      const { result, error } = await tryCatch(() =>
        this.dependencies.converter.modify(docxPath, modifications),
      );
      if (error) {
        this.logger.error('Docx operation "ModifyDocxWithJson" failed', {
          path: docxPath,
          error,
        });
        return {
          error: `Docx operation "ModifyDocxWithJson" failed for path "${docxPath}": ${error.message || "Unknown error"}`,
          docxPath,
        };
      }

      return { error: null, docxPath, ...result };
    },
  });
}
