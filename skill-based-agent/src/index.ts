import { resolve } from "node:path";
import type { ModelMessage } from "ai";

import { consoleLogger } from "./logger";
import { buildAgentApp } from "./agent";
import { createFileMessageStore } from "./messages";

const DEFAULT_MESSAGES_PATH = resolve("tmp/messages.json");

async function main(): Promise<void> {
  try {
    const userMessage = process.argv.slice(2).join(" ").trim();
    if (!userMessage) {
      console.error('Usage: bun src/index.ts "<message>"');
      process.exitCode = 1;
      return;
    }

    const messagesPath = process.env.MESSAGES_PATH ?? DEFAULT_MESSAGES_PATH;
    const store = createFileMessageStore(messagesPath);

    const history = await store.load();
    const messages: ModelMessage[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    const app = buildAgentApp({
      logger: consoleLogger,
    });

    const result = await app.run(messages);
    console.log(result.text);

    const updatedMessages: ModelMessage[] = [
      ...messages,
      ...result.responseMessages,
    ];
    await store.save(updatedMessages);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error";
    console.error(`Agent startup failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
