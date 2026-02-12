import { consoleLogger } from "./logger";
import { buildAgentApp } from "./agent";

async function main(): Promise<void> {
  try {
    const userMessage = process.argv.slice(2).join(" ").trim();
    if (!userMessage) {
      console.error('Usage: bun src/index.ts "<message>"');
      process.exitCode = 1;
      return;
    }

    const app = buildAgentApp({
      logger: consoleLogger,
    });

    const result = await app.run(userMessage);
    console.log(result.text);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error";
    console.error(`Agent startup failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
