import { join } from "node:path";

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
      // Use Bun.file to read the file
      const file = Bun.file(filePath);

      // Check if file exists
      const exists = await file.exists();
      if (!exists) {
        throw new Error(
          `Capability declaration file "${fileName}" not found in ${declarationsDir}`,
        );
      }

      // Read and return the file content
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
