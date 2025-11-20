import { cwd } from "process";
import path from "path";
import { tool } from "langchain";
import z from "zod";

type ExecuteCodeResult = {
  output: string;
  error: string | null;
};

export async function executeCodeHandler(
  codeSnippet: string,
): Promise<ExecuteCodeResult> {
  // Create temporary file
  const tmpCodeDir = path.join(cwd(), "./.tmp");
  const newTmpFileName = Bun.randomUUIDv7("hex", Date.now()) + ".ai.ts";
  const tmpFilePath = path.join(tmpCodeDir, newTmpFileName);

  try {
    await Bun.write(tmpFilePath, codeSnippet);

    // Execute the file with Bun and capture stdout
    const proc = Bun.spawn(["bun", tmpFilePath], {
      cwd: cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });
    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();

    await proc.exited;

    return {
      output,
      error: errorOutput,
    };
  } catch (err: any) {
    return {
      output: "",
      error:
        "Code execution failed due to internal error!\n\n" +
        (err?.message || ""),
    };
  }
}

/**
 * Tool that allows the LLM to execute TypeScript code.
 * The code will be executed in a temporary file with access to all available capabilities.
 */
export const executeCodeTool = tool(
  async ({ code }: { code: string }) => {
    try {
      const result = await executeCodeHandler(code);
      if (result.error) {
        return `Error executing code:\n${result.error}\n\nOutput:\n${result.output}`;
      }
      return `Code executed successfully!\n\nOutput:\n${result.output}`;
    } catch (err) {
      console.error("Code execution failed due to internal error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return `Failed to execute code due to internal error: ${errorMessage}`;
    }
  },
  {
    name: "execute_code",
    description: `Execute TypeScript code to perform tasks using available capabilities.

The code will be executed with access to all capability modules via import statements.
Available capabilities can be imported using the @tools namespace (e.g., import { getEmails } from "@tools/emailTools").

Use this tool when you need to:
- Interact with user's email
- Perform complex operations using available capabilities
- Execute any code that requires access to the declaration files

The code should be valid TypeScript and will be executed in a Bun runtime.`,
    schema: z.object({
      code: z.string().describe("The TypeScript code to execute"),
    }),
  },
);
