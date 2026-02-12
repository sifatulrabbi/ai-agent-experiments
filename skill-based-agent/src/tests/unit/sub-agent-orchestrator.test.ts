import { describe, expect, test } from "bun:test";

import { extractOutputPathFromSteps } from "../../sub-agent-orchestrator";

describe("extractOutputPathFromSteps", () => {
  test("returns last WriteFile path", () => {
    const outputPath = extractOutputPathFromSteps([
      {
        staticToolCalls: [
          { toolName: "WriteFile", input: { path: "/tmp/first.txt" } },
        ],
      },
      {
        staticToolCalls: [
          { toolName: "ReadDir", input: {} },
          { toolName: "WriteFile", input: { path: "/tmp/final.txt" } },
        ],
      },
    ]);

    expect(outputPath).toBe("/tmp/final.txt");
  });

  test("returns undefined when WriteFile is absent", () => {
    const outputPath = extractOutputPathFromSteps([
      {
        staticToolCalls: [{ toolName: "ReadDir", input: {} }],
      },
    ]);

    expect(outputPath).toBeUndefined();
  });
});
