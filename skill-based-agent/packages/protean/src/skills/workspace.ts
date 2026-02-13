import { tool } from "ai";
import z from "zod";

import {
  type SkillDefinition,
  type SkillMetadata,
  renderSkillFrontmatter,
} from "./base";
import { type FS } from "../services/fs";

export interface WorkspaceSkillDeps {
  fsClient: FS;
}

export function createWorkspaceSkill(
  deps: WorkspaceSkillDeps,
): SkillDefinition<WorkspaceSkillDeps> {
  const { fsClient } = deps;

  const GetFileStat = tool({
    description:
      "Get metadata (size, type, timestamps) for a single file or directory.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file or directory to inspect."),
    }),
    execute: async ({ path }) => {
      const info = await fsClient.stat(path);
      return { path, ...info };
    },
  });

  const ReadDir = tool({
    description:
      "Read directory entries with their types. Returns an array of objects with name and isDirectory fields.",
    inputSchema: z.object({
      path: z.string().describe("Path to the directory to read."),
    }),
    execute: async ({ path }) => {
      const entries = await fsClient.readdir(path);
      return { path, entries };
    },
  });

  const GetFileContent = tool({
    description:
      "Read the full text content of a file. Only use on text-based files.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read."),
    }),
    execute: async ({ path }) => {
      const content = await fsClient.readFile(path);
      return { path, content };
    },
  });

  const CreateDirectory = tool({
    description:
      "Create a directory (including intermediate directories) at the given path.",
    inputSchema: z.object({
      path: z.string().describe("Path of the directory to create."),
    }),
    execute: async ({ path }) => {
      await fsClient.mkdir(path);
      return { path, created: true };
    },
  });

  const WriteFile = tool({
    description:
      "Write text content to a file. Creates the file if it does not exist, overwrites if it does.",
    inputSchema: z.object({
      path: z.string().describe("Path of the file to write."),
      content: z.string().describe("The text content to write to the file."),
    }),
    execute: async ({ path, content }) => {
      await fsClient.writeFile(path, content);
      return { path, bytesWritten: content.length };
    },
  });

  const Remove = tool({
    description: "Remove any file or directory with this tool.",
    inputSchema: z.object({
      path: z.string().describe("Path of the file or directory to remove"),
    }),
    execute: async () => {
      await fsClient;
    },
  });

  const metadata: SkillMetadata = {
    id: "workspace-skill",
    version: "1.0.0",
    description:
      "Core filesystem skill. Read, write, and navigate files and directories in the sandboxed workspace.",
    useWhen:
      "Any task that involves reading files, listing directories, creating files, or writing content. This is the foundational skill - most other skills depend on it.",
    toolNames: [
      "GetFileStat",
      "ReadDir",
      "GetFileContent",
      "CreateDirectory",
      "WriteFile",
      "Remove",
    ],
    dependencies: [],
  };

  const workspaceSkill: SkillDefinition<WorkspaceSkillDeps> = {
    id: metadata.id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `# Workspace Skill

You have access to a sandboxed project workspace through the tools below.
All paths are resolved relative to the workspace root unless an absolute path is given.

## Available Tools

### GetFileStat
Returns metadata for a single file or directory: size (bytes), isDirectory, modified, and created timestamps.
Use this to check whether a path is a file or directory, or to inspect size before reading.

### ReadDir
Returns directory entries with both name and isDirectory flag.
Use this to explore what exists at a location and distinguish files from directories.

### GetFileContent
Returns the full text content of a file. Only use on text files (source code, config, markdown, etc.).
For large files, check GetFileStat first to avoid reading unexpectedly large content.

### CreateDirectory
Creates a directory at the given path, including any missing intermediate directories.

### WriteFile
Writes text content to a file. Creates the file if it doesn't exist, overwrites if it does.
Always confirm with the user before overwriting existing files.

### Remove
Remove either a directory or file from the workspace.

## Guidelines

- Read before you write: inspect existing files before modifying them.
- Use GetFileStat to check size before reading large files.
- Prefer ReadDir when you need to tell files from directories.
- Never write to paths outside the workspace root.`,
    tools: {
      GetFileStat,
      ReadDir,
      GetFileContent,
      CreateDirectory,
      WriteFile,
      Remove,
    },
    dependencies: deps,
  };

  return workspaceSkill;
}
