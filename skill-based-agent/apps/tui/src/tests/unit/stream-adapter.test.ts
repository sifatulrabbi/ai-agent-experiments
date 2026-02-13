import { describe, expect, test } from "bun:test";
import { type ToolLoopAgent, type UIMessageChunk } from "ai";

import { runStreamTurn } from "../../tui/stream-adapter";
import { createTuiStore } from "../../tui/store";

async function* chunkStream(
  chunks: UIMessageChunk[],
): AsyncGenerator<UIMessageChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("runStreamTurn", () => {
  test("streams chunks and persists response history", async () => {
    const store = createTuiStore({ initialMessages: [], debugEnabled: false });
    const savedPayloads: unknown[] = [];

    const fakeAgent = {
      stream: async () => ({
        toUIMessageStream: () =>
          chunkStream([
            { type: "text-start", id: "a1" } as UIMessageChunk,
            { type: "text-delta", id: "a1", delta: "hello" } as UIMessageChunk,
            { type: "finish", finishReason: "stop" } as UIMessageChunk,
          ]),
        response: Promise.resolve({
          messages: [{ role: "assistant", content: "hello" }],
        }),
      }),
    } as unknown as ToolLoopAgent;

    await runStreamTurn({
      agent: fakeAgent,
      store,
      messageStore: {
        load: async () => [],
        save: async (messages) => {
          savedPayloads.push(messages);
        },
      },
      userText: "say hello",
    });

    const state = store.getState();
    expect(state.transcript.length).toBe(2);
    expect(state.transcript[1]?.text).toBe("hello");
    expect(savedPayloads.length).toBe(1);
  });
});
