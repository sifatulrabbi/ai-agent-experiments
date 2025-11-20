import { test, expect, describe } from "bun:test";
import { readCapabilityDeclarations } from "../src/llmTools/readCapabilityDeclaration";

describe("readCapabilityDeclarations", () => {
  test("should read a single file", async () => {
    const contents = await readCapabilityDeclarations(["emailTools.d.ts"]);
    const content = contents.get("emailTools.d.ts");

    console.log("\n--- File Content (first 200 chars) ---");
    console.log(content!.substring(0, 200) + "...");
    console.log("--- End Content ---\n");

    // Should have one entry
    expect(contents.size).toBe(1);

    // Should not be empty
    expect(content!.length).toBeGreaterThan(0);

    // Should contain TypeScript declaration content
    expect(content).toContain("export");

    // Should contain the EmailObject type
    expect(content).toContain("EmailObject");
  });

  test("should contain expected type definitions", async () => {
    const contents = await readCapabilityDeclarations(["emailTools.d.ts"]);
    const content = contents.get("emailTools.d.ts");

    // Should have type definitions
    expect(content).toContain("export type EmailObject");
    expect(content).toContain("export type EmailObjectRecord");

    // Should have function declarations
    expect(content).toContain("export function getEmails");
    expect(content).toContain("export function sendEmail");
  });

  test("should read multiple declaration files", async () => {
    const contents = await readCapabilityDeclarations(["emailTools.d.ts"]);
    console.log("\n--- Multiple Files Read ---");
    console.log(`Number of files: ${contents.size}`);
    console.log(`Files: ${Array.from(contents.keys()).join(", ")}`);
    console.log("--- End ---\n");

    // Should have one entry
    expect(contents.size).toBe(1);

    // Should have the emailTools.d.ts content
    expect(contents.has("emailTools.d.ts")).toBe(true);

    // Content should not be empty
    const emailToolsContent = contents.get("emailTools.d.ts");
    expect(emailToolsContent).toBeDefined();
    expect(emailToolsContent!.length).toBeGreaterThan(0);
  });

  test("should return a Map with correct structure", async () => {
    const contents = await readCapabilityDeclarations(["emailTools.d.ts"]);

    // Should be a Map instance
    expect(contents).toBeInstanceOf(Map);

    // Should have the correct keys
    expect(Array.from(contents.keys())).toEqual(["emailTools.d.ts"]);

    // Values should be strings
    const content = contents.get("emailTools.d.ts");
    expect(typeof content).toBe("string");
  });

  test("should read multiple files in parallel", async () => {
    // Add the same file multiple times to test parallel reading
    const contents = await readCapabilityDeclarations([
      "emailTools.d.ts",
      "emailTools.d.ts",
    ]);

    // Should have only one unique entry (Map handles duplicates)
    expect(contents.size).toBe(1);
  });

  test("should throw error for non-existent file", async () => {
    expect(async () => {
      await readCapabilityDeclarations(["nonExistent.d.ts"]);
    }).toThrow();
  });

  test("should throw error with descriptive message for non-existent file", async () => {
    try {
      await readCapabilityDeclarations(["nonExistent.d.ts"]);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain("nonExistent.d.ts");
        expect(error.message).toContain("not found");
      }
    }
  });

  test("should throw error if any file doesn't exist", async () => {
    expect(async () => {
      await readCapabilityDeclarations(["emailTools.d.ts", "nonExistent.d.ts"]);
    }).toThrow();
  });
});
