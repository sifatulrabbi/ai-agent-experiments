import { describe, expect, test } from "bun:test";

import { safeParseJson, toSafeBasename } from "../../utils/tool-utils";

describe("tool utils", () => {
  test("safeParseJson parses valid json", () => {
    const result = safeParseJson<{ hello: string }>(
      '{"hello":"world"}',
      "test",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hello).toBe("world");
    }
  });

  test("safeParseJson returns structured error for invalid json", () => {
    const result = safeParseJson("{", "test");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TOOL_INPUT");
    }
  });

  test("toSafeBasename normalizes unusual filenames", () => {
    const value = toSafeBasename("/tmp/My Weird.File.Name.docx");
    expect(value).toBe("my-weird-file-name");
  });
});
