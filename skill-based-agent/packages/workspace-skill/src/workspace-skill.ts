import { tool } from "ai";
import { z } from "zod";
import { Skill } from "@protean/skill";
import { type Logger } from "@protean/logger";
import { tryCatch } from "@protean/utils";

import { type FS } from "./fs";

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
        instructions: "",
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
      path: z.string().describe("Path to the file or directory to inspect."),
    }),
    execute: async ({ path }) => {
      this.dependencies.logger.debug('Running workspace operation "GetFileStat"', { path });
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.stat(path),
      );
      if (error) {
        this.logger.error('Workspace operation "GetFileStat" failed', {
          path,
          error,
        });
        return {
          error: `Workspace operation "GetFileStat" failed for path "${path}": ${error.message || "Unknown filesystem error"}`,
          path,
        };
      }

      return { error: null, path, ...result };
    },
  });

  ReadDir = tool({
    description:
      "Read directory entries with their types. Returns an array of objects with name and isDirectory fields.",
    inputSchema: z.object({
      path: z.string().describe("Path to the directory to read."),
    }),
    execute: async ({ path }) => {
      this.dependencies.logger.debug('Running workspace operation "ReadDir"', { path });
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.readdir(path),
      );
      if (error) {
        this.logger.error('Workspace operation "ReadDir" failed', {
          path,
          error,
        });
        return {
          error: `Workspace operation "ReadDir" failed for path "${path}": ${error.message || "Unknown filesystem error"}`,
          path,
        };
      }

      return { error: null, path, entries: result };
    },
  });

  GetFileContent = tool({
    description:
      "Read the full text content of a file. Only use on text-based files.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read."),
    }),
    execute: async ({ path }) => {
      this.dependencies.logger.debug('Running workspace operation "GetFileContent"', { path });
      const { result, error } = await tryCatch(() =>
        this.dependencies.fsClient.readFile(path),
      );
      if (error) {
        this.logger.error('Workspace operation "GetFileContent" failed', {
          path,
          error,
        });
        return {
          error: `Workspace operation "GetFileContent" failed for path "${path}": ${error.message || "Unknown filesystem error"}`,
          path,
        };
      }

      return { error: null, path, content: result };
    },
  });

  CreateDirectory = tool({
    description:
      "Create a directory (including intermediate directories) at the given path.",
    inputSchema: z.object({
      path: z.string().describe("Path of the directory to create."),
    }),
    execute: async ({ path }) => {
      this.dependencies.logger.debug('Running workspace operation "CreateDirectory"', { path });
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.mkdir(path),
      );
      if (error) {
        this.logger.error('Workspace operation "CreateDirectory" failed', {
          path,
          error,
        });
        return {
          error: `Workspace operation "CreateDirectory" failed for path "${path}": ${error.message || "Unknown filesystem error"}`,
          path,
          created: false,
        };
      }

      return { error: null, path, created: true };
    },
  });

  WriteFile = tool({
    description:
      "Write text content to a file. Creates the file if it does not exist, overwrites if it does.",
    inputSchema: z.object({
      path: z.string().describe("Path of the file to write."),
      content: z.string().describe("The text content to write to the file."),
    }),
    execute: async ({ path, content }) => {
      this.dependencies.logger.debug('Running workspace operation "WriteFile"', {
        path,
        bytes: content.length,
      });
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.writeFile(path, content),
      );
      if (error) {
        this.logger.error('Workspace operation "WriteFile" failed', {
          path,
          error,
        });
        return {
          error: `Workspace operation "WriteFile" failed for path "${path}": ${error.message || "Unknown filesystem error"}`,
          path,
          bytesWritten: 0,
        };
      }

      return {
        error: null,
        path,
        bytesWritten: content.length,
      };
    },
  });

  Remove = tool({
    description: "Remove any file or directory with this tool.",
    inputSchema: z.object({
      path: z.string().describe("Path of the file or directory to remove"),
    }),
    execute: async (args) => {
      this.dependencies.logger.debug('Running workspace operation "Remove"', {
        path: args.path,
      });
      const { error } = await tryCatch(() =>
        this.dependencies.fsClient.remove(args.path),
      );
      if (error) {
        this.logger.error('Workspace operation "Remove" failed', {
          path: args.path,
          error,
        });
        return {
          error: `Workspace operation "Remove" failed for path "${args.path}": ${error.message || "Unknown filesystem error"}`,
          path: args.path,
          removed: false,
        };
      }

      return { error: null, path: args.path, removed: true };
    },
  });
}
