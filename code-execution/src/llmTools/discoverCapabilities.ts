import { join, relative } from "node:path";

/**
 * Discovers all capability declaration files available in the capabilities/declarations directory.
 * Returns a formatted string listing all available capabilities in an LLM-friendly format.
 *
 * @returns A formatted string listing all capability declaration files relative to the current working directory
 */
export async function discoverCapabilities(): Promise<string> {
  const declarationsDir = join(process.cwd(), "capabilities", "declarations");

  try {
    // Use Bun's Glob API to find all .d.ts files
    const glob = new Bun.Glob("*.d.ts");
    const files = await Array.fromAsync(glob.scan(declarationsDir));

    if (files.length === 0) {
      return "No capability declaration files found.";
    }

    // Build an LLM-friendly formatted string
    const header = "Available Capabilities:\n\n";
    const fileList = files
      .map((file, index) => {
        const relativePath = relative(
          process.cwd(),
          join(declarationsDir, file),
        );
        return `${index + 1}. ${relativePath}`;
      })
      .join("\n");

    return header + fileList;
  } catch (error) {
    if (error instanceof Error) {
      return `Error discovering capabilities: ${error.message}`;
    }
    return "Error discovering capabilities: Unknown error occurred";
  }
}
