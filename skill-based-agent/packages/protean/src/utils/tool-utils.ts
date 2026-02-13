import path from "node:path";

import { InvalidToolInputError } from "../errors";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: InvalidToolInputError };

export function safeParseJson<T>(
  input: string,
  context: string,
): ParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(input) as T };
  } catch {
    return {
      ok: false,
      error: new InvalidToolInputError(context, "expected valid JSON string"),
    };
  }
}

export function toSafeBasename(filePath: string): string {
  const rawBase = path.posix.basename(filePath.trim());
  const withoutExt = rawBase.replace(/\.[^.]+$/, "");
  const sanitized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized.length > 0 ? sanitized : "file";
}

export function isValidPathLike(filePath: string): boolean {
  const trimmed = filePath.trim();
  return trimmed.length > 0 && !trimmed.includes("\u0000");
}

export function toToolErrorPayload(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof Error) {
    return { code: "TOOL_EXECUTION_ERROR", message: error.message };
  }

  return {
    code: "TOOL_EXECUTION_ERROR",
    message: "Unexpected tool execution error",
  };
}
