import { tool } from "ai";
import { z } from "zod";
import { Skill } from "@protean/skill";
import { type Logger } from "@protean/logger";
import { tryCatch } from "@protean/utils";

import { type FS } from "./fs";
import { workspaceSkillInstructions } from "./instructions";

export interface WorkspaceSkillDeps {
  fsClient: FS;
  logger: Logger;
}

export class WorkspaceSkill extends Skill<WorkspaceSkillDeps> {
  constructor(dependencies: WorkspaceSkillDeps) {
    super(
      {
        id: "workspace-skill",
        description: "",
        instructions: workspaceSkillInstructions,
        dependencies: dependencies,
      },
      dependencies.logger,
    );
  }

  get tools() {
    return {
      GetFileStat: this.GetFileStat,
      GetFileContent: this.GetFileContent,
      CreateDirectory: this.CreateDirectory,
      WriteFile: this.WriteFile,
      Remove: this.Remove,
    };
  }

  GetFileStat = tool({
    description:
      "Get metadata (size, type, timestamps) for a single file or directory.",
    inputSchema: z.object({
      fullPath: z
        .string()
        .describe("Path to the file or directory to inspect."),
    }),
    execute: async ({ fullPath }) => {
      this.dependencies.logger.debug(
        'Running workspace operation "GetFileStat"',
        { path: fullPath },
      );
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.stat(fullPath),
      );
      if (error) {
        this.logger.error('Workspace operation "GetFileStat" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "GetFileStat" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          fullPath,
        };
      }

      return { error: null, fullPath, ...result };
    },
  });

  ReadDir = tool({
    description:
      "Read directory entries with their types. Returns an array of objects with name and isDirectory fields.",
    inputSchema: z.object({
      fullPath: z.string().describe("Path to the directory to read."),
    }),
    execute: async ({ fullPath }) => {
      this.dependencies.logger.debug('Running workspace operation "ReadDir"', {
        path: fullPath,
      });
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.readdir(fullPath),
      );
      if (error) {
        this.logger.error('Workspace operation "ReadDir" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "ReadDir" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          fullPath,
        };
      }

      return { error: null, fullPath, entries: result };
    },
  });

  GetFileContent = tool({
    description:
      "Read the full text content of a file. Only use on text-based files.",
    inputSchema: z.object({
      fullPath: z.string().describe("Path to the file to read."),
    }),
    execute: async ({ fullPath }) => {
      this.dependencies.logger.debug(
        'Running workspace operation "GetFileContent"',
        { path: fullPath },
      );
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.readFile(fullPath),
      );
      if (error) {
        this.logger.error('Workspace operation "GetFileContent" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "GetFileContent" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          fullPath,
        };
      }

      return { error: null, fullPath, content: result };
    },
  });

  CreateDirectory = tool({
    description:
      "Create a directory (including intermediate directories) at the given path.",
    inputSchema: z.object({
      fullPath: z.string().describe("Path of the directory to create."),
    }),
    execute: async ({ fullPath }) => {
      this.dependencies.logger.debug(
        'Running workspace operation "CreateDirectory"',
        { path: fullPath },
      );
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.mkdir(fullPath),
      );
      if (error) {
        this.logger.error('Workspace operation "CreateDirectory" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "CreateDirectory" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          path: fullPath,
          created: false,
        };
      }

      return { error: null, fullPath, created: true };
    },
  });

  WriteFile = tool({
    description:
      "Write text content to a file. Creates the file if it does not exist, overwrites if it does.",
    inputSchema: z.object({
      fullPath: z.string().describe("Path of the file to write."),
      content: z.string().describe("The text content to write to the file."),
    }),
    execute: async ({ fullPath, content }) => {
      this.dependencies.logger.debug(
        'Running workspace operation "WriteFile"',
        {
          path: fullPath,
          bytes: content.length,
        },
      );
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.writeFile(fullPath, content),
      );
      if (error) {
        this.logger.error('Workspace operation "WriteFile" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "WriteFile" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          fullPath,
          bytesWritten: 0,
        };
      }

      return {
        error: null,
        fullPath,
        bytesWritten: content.length,
      };
    },
  });

  Remove = tool({
    description: "Remove any file or directory with this tool.",
    inputSchema: z.object({
      fullPath: z.string().describe("Path of the file or directory to remove"),
    }),
    execute: async ({ fullPath }) => {
      this.dependencies.logger.debug('Running workspace operation "Remove"', {
        path: fullPath,
      });
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.remove(fullPath),
      );
      if (error) {
        this.logger.error('Workspace operation "Remove" failed', {
          path: fullPath,
          error,
        });
        return {
          error: `Workspace operation "Remove" failed for path "${fullPath}": ${error.message || "Unknown filesystem error"}`,
          fullPath,
          removed: false,
        };
      }

      return { error: null, fullPath, removed: true };
    },
  });
}
