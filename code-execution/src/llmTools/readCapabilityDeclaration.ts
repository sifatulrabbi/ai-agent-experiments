import { tool } from "langchain";
import { join } from "node:path";
import z from "zod";

/**
 * Reads capability declaration files from the capabilities/declarations directory.
 * Can read single or multiple files and returns a map of file names to their contents.
 *
 * @param fileNames - An array of file names (e.g., ["emailTools.d.ts"] or ["emailTools.d.ts", "otherTool.d.ts"])
 * @returns A map of file names to their contents
 * @throws Error if any file doesn't exist or cannot be read
 *
 * @example
 * // Read a single file
 * const contents = await readCapabilityDeclarations(["emailTools.d.ts"]);
 * console.log(contents.get("emailTools.d.ts"));
 *
 * @example
 * // Read multiple files
 * const contents = await readCapabilityDeclarations(["emailTools.d.ts", "otherTool.d.ts"]);
 * console.log(contents.get("emailTools.d.ts"));
 */
export async function readCapabilityDeclarations(
  fileNames: string[],
): Promise<Map<string, string>> {
  const declarationsDir = join(process.cwd(), "capabilities", "declarations");
  const results = new Map<string, string>();

  // Read all files in parallel
  const promises = fileNames.map(async (fileName) => {
    const filePath = join(declarationsDir, fileName);

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) {
        throw new Error(
          `Capability declaration file "${fileName}" not found in ${declarationsDir}`,
        );
      }
      const content = await file.text();
      return { fileName, content };
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw if it's already our custom error
        if (error.message.includes("not found")) {
          throw error;
        }
        throw new Error(
          `Failed to read capability declaration "${fileName}": ${error.message}`,
        );
      }
      throw new Error(
        `Failed to read capability declaration "${fileName}": Unknown error occurred`,
      );
    }
  });

  const fileContents = await Promise.all(promises);

  // Populate the map
  for (const { fileName, content } of fileContents) {
    results.set(fileName, content);
  }

  return results;
}

/**
 * Tool that allows the LLM to read capability declaration files.
 * This helps the LLM understand the full API of a capability before using it.
 */
export const readDeclarationTool = tool(
  async ({ fileNames }: { fileNames: string[] }) => {
    try {
      const declarations = await readCapabilityDeclarations(fileNames);

      let result = "# Capability Declaration Files\n\n";
      for (const [fileName, content] of declarations.entries()) {
        result += `## ${fileName}\n\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
      }

      return result;
    } catch (err) {
      console.error(
        "Failed to read declaration files due to internal error:",
        err,
      );
      const errorMessage = err instanceof Error ? err.message : String(err);
      return `Failed to read declaration files due to internal error: ${errorMessage}`;
    }
  },
  {
    name: "read_capability_declaration",
    description: `Read one or more capability declaration files to understand their full API.

Declaration files contain TypeScript type definitions, function signatures, and JSDoc documentation
that explain how to use each capability.

Use this tool when you need to:
- Understand the full API of a capability before using it
- See all available functions and types in a capability
- Read detailed documentation and examples

The files are located in capabilities/declarations/ and end with .d.ts extension.`,
    schema: z.object({
      fileNames: z
        .array(z.string())
        .describe(
          "Array of declaration file names to read (e.g., ['emailTools.d.ts'])",
        ),
    }),
  },
);
