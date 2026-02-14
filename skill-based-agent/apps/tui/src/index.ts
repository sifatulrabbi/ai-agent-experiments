import { type ModelMessage } from "ai";
import { render } from "ink";
import { createElement } from "react";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRootAgent, formatChunk } from "@protean/protean";

import { createFileMessageStore } from "./messages";
import { TuiApp } from "./tui/app";

const DEFAULT_HISTORY_PATH = resolve(
  import.meta.dir,
  "../../../tmp/history.json",
);

interface CliOptions {
  useTui: boolean;
  historyPath: string;
  debugStream: boolean;
}

function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseArgs(argv: string[]): CliOptions {
  let useTui = true;
  let historyPath = DEFAULT_HISTORY_PATH;
  let debugStream = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--no-tui") {
      useTui = false;
      continue;
    }

    if (arg.startsWith("--tui=")) {
      useTui = parseBooleanFlag(arg.split("=")[1], true);
      continue;
    }

    if (arg === "--tui") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        useTui = parseBooleanFlag(next, true);
        i += 1;
      } else {
        useTui = true;
      }
      continue;
    }

    if (arg.startsWith("--history=")) {
      historyPath = arg.slice("--history=".length);
      continue;
    }

    if (arg === "--history") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        historyPath = next;
        i += 1;
      }
      continue;
    }

    if (arg === "--debug-stream") {
      debugStream = true;
      continue;
    }
  }

  return {
    useTui,
    historyPath,
    debugStream,
  };
}

async function runPlainMode(
  agent: Awaited<ReturnType<typeof createRootAgent>>,
  history: ModelMessage[],
  historyPath: string,
): Promise<void> {
  const messageStore = createFileMessageStore(historyPath);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const pipedText = readFileSync(0, "utf-8").trim();
    if (!pipedText) {
      return;
    }

    const messages = [
      ...history,
      { role: "user" as const, content: pipedText },
    ];
    const stream = await agent.stream({ messages });

    for await (const chunk of stream.toUIMessageStream()) {
      process.stdout.write(formatChunk(chunk));
    }

    const response = await stream.response;
    await messageStore.save([...messages, ...response.messages]);
    return;
  }

  const rl = createInterface({ input, output });
  let workingHistory = [...history];

  console.log('Plain mode. Type "exit" to quit.\n');

  try {
    while (true) {
      const userText = (await rl.question("> ")).trim();
      if (!userText) {
        continue;
      }
      if (
        userText.toLowerCase() === "exit" ||
        userText.toLowerCase() === "quit"
      ) {
        break;
      }

      workingHistory.push({ role: "user", content: userText });

      const stream = await agent.stream({
        messages: workingHistory,
      });

      for await (const chunk of stream.toUIMessageStream()) {
        process.stdout.write(formatChunk(chunk));
      }
      console.log("");

      const response = await stream.response;
      workingHistory.push(...response.messages);
      await messageStore.save(workingHistory);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const messageStore = createFileMessageStore(options.historyPath);
  const history = await messageStore.load();
  const agent = await createRootAgent();

  const canUseTui = process.stdin.isTTY && process.stdout.isTTY;

  if (options.useTui && canUseTui) {
    const app = render(
      createElement(TuiApp, {
        agent,
        messageStore,
        initialMessages: history,
        debugStreamDefault: options.debugStream,
      }),
    );

    await app.waitUntilExit();
    return;
  }

  await runPlainMode(agent, history, options.historyPath);
}

void main();
