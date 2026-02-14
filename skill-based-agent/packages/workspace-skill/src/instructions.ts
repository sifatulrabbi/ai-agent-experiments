export const workspaceSkillDescription =
  "Core filesystem skill. Read, write, and navigate files and directories in the sandboxed workspace. Any task that involves reading files, listing directories, creating files, or writing content. This is the foundational skill - most other skills depend on it.";

export const workspaceSkillInstructions = `# Workspace Skill

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
- Never write to paths outside the workspace root.`;
