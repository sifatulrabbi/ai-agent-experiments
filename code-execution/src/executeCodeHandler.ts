import { tryCatch } from "./utils";
import { cwd } from "process";
import path from "path";

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

  await Bun.write(tmpFilePath, codeSnippet);

  const { data, error } = await tryCatch(async () => {
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
      errorOutput,
    };
  });

  if (error) {
    return {
      output: "",
      error: "Code execution failed!\n\n" + error.message,
    };
  }

  return {
    output: data.output,
    error: data.errorOutput || null,
  };
}
