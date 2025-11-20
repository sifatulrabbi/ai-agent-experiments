import { test, expect, describe } from "bun:test";
import { executeCodeHandler } from "../src/executeCodeHandler";
import path from "path";
import { cwd } from "process";
import { existsSync } from "fs";

describe("executeCodeHandler", () => {
  const tmpDir = path.join(cwd(), "./.tmp");

  test("should execute simple code and return output", async () => {
    const codeSnippet = `console.log("Hello, World!");`;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("Hello, World!");
    expect(result.error).toBeNull();
  });

  test("should handle code with multiple console.log statements", async () => {
    const codeSnippet = `console.log("First line");
console.log("Second line");
    `;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("First line");
    expect(result.output).toContain("Second line");
    expect(result.error).toBeNull();
  });

  test("should execute code with calculations", async () => {
    const codeSnippet = `const sum = 2 + 2;
console.log(sum);
    `;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("4");
    expect(result.error).toBeNull();
  });

  test("should capture stderr output when code has runtime errors", async () => {
    const codeSnippet = `throw new Error("Test error");`;
    const result = await executeCodeHandler(codeSnippet);

    // Error output should be captured in the error field
    expect(result.error).toContain("Test error");
  });

  test("should handle code with syntax errors", async () => {
    const codeSnippet = `
      const x = ;
    `;
    const result = await executeCodeHandler(codeSnippet);

    // Should capture the error
    expect(result.error).not.toBeNull();
  });

  test("should handle async code execution", async () => {
    const codeSnippet = `async function test() {
  return "Async result";
}
test().then(result => console.log(result));
    `;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("Async result");
  });

  test("should handle code using Bun APIs", async () => {
    const codeSnippet = `const uuid = Bun.randomUUIDv7();
console.log("UUID generated:", typeof uuid);
    `;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("UUID generated: string");
    expect(result.error).toBeNull();
  });

  test("should create temporary file with .ai.ts extension", async () => {
    const codeSnippet = `console.log("test");`;
    await executeCodeHandler(codeSnippet);

    // Check that .tmp directory exists
    expect(existsSync(tmpDir)).toBe(true);
  });

  test("should handle empty code snippet", async () => {
    const codeSnippet = "";
    const result = await executeCodeHandler(codeSnippet);

    // Should execute without errors
    expect(result.output).toBe("");
    expect(result.error).toBeNull();
  });

  test("should handle code with imports", async () => {
    const codeSnippet = `import path from "path";
console.log("Path joined:", path.join("a", "b"));
    `;
    const result = await executeCodeHandler(codeSnippet);

    expect(result.output).toContain("Path joined:");
    expect(result.output).toContain(path.join("a", "b"));
    expect(result.error).toBeNull();
  });
});
