import { test, expect, describe } from "bun:test";
import { discoverCapabilities } from "../src/llmTools/discoverCapabilities";

describe("discoverCapabilities", () => {
  test("should return a list of available capability declaration files", async () => {
    const result = await discoverCapabilities();
    console.log("\n--- Discovery Output ---");
    console.log(result);
    console.log("--- End Output ---\n");

    // Should contain the header
    expect(result).toContain("Available Capabilities:");

    // Should contain the emailTools.d.ts file
    expect(result).toContain("capabilities/declarations/emailTools.d.ts");

    // Should be numbered
    expect(result).toMatch(/\d+\.\s+capabilities\/declarations\/\w+\.d\.ts/);
  });

  test("should return formatted numbered list", async () => {
    const result = await discoverCapabilities();

    // Should start with "1." for the first item
    expect(result).toContain("1. capabilities/declarations/");
  });

  test("should list all .d.ts files in declarations directory", async () => {
    const result = await discoverCapabilities();

    // Split by newlines and filter out empty lines and header
    const lines = result
      .split("\n")
      .filter(
        (line) => line.trim() && !line.includes("Available Capabilities"),
      );

    // Should have at least one declaration file (emailTools.d.ts)
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // Each line should be a numbered item with a .d.ts file
    lines.forEach((line) => {
      expect(line).toMatch(/^\d+\.\s+capabilities\/declarations\/\w+\.d\.ts$/);
    });
  });

  test("should use relative paths from cwd", async () => {
    const result = await discoverCapabilities();

    // Should not contain absolute paths
    expect(result).not.toContain(process.cwd());

    // Should contain relative paths starting with capabilities/
    expect(result).toContain("capabilities/declarations/");
  });
});
