import { type ToolLoopAgent, type UIMessageChunk } from "ai";

import { type MessageStore } from "../messages";
import { type TuiStore } from "./store";

const CHUNK_BATCH_SIZE = 8;

export interface StreamAgent {
  stream: ToolLoopAgent["stream"];
}

interface RunStreamTurnArgs {
  agent: StreamAgent;
  store: TuiStore;
  messageStore: MessageStore;
  userText: string;
}

function applyBatch(store: TuiStore, chunks: UIMessageChunk[]): void {
  for (const chunk of chunks) {
    store.getState().applyChunk(chunk);
  }
}

export async function runStreamTurn(args: RunStreamTurnArgs): Promise<void> {
  const { agent, store, messageStore, userText } = args;
  const state = store.getState();

  if (state.isStreaming) {
    store.getState().setStatus("Wait for the current response to finish");
    return;
  }

  store.getState().startTurn(userText);

  try {
    const stream = await agent.stream({
      messages: store.getState().history,
    });

    const queuedChunks: UIMessageChunk[] = [];

    for await (const chunk of stream.toUIMessageStream()) {
      queuedChunks.push(chunk);
      if (queuedChunks.length >= CHUNK_BATCH_SIZE) {
        applyBatch(store, queuedChunks.splice(0, queuedChunks.length));
      }
    }

    if (queuedChunks.length > 0) {
      applyBatch(store, queuedChunks.splice(0, queuedChunks.length));
    }

    const response = await stream.response;
    store.getState().finishTurn(response.messages);
    await messageStore.save(store.getState().history);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown streaming error";
    store.getState().failTurn(message);
  }
}
