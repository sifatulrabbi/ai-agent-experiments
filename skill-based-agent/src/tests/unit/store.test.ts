import { describe, expect, test } from "bun:test";
import { type UIMessageChunk } from "ai";

import { createTuiStore } from "../../tui/store";

describe("createTuiStore", () => {
  test("applies chunk deltas and finalizes transcript", () => {
    const store = createTuiStore({
      initialMessages: [],
      debugEnabled: false,
    });

    store.getState().startTurn("hello");
    store
      .getState()
      .applyChunk({ type: "text-start", id: "t1" } as UIMessageChunk);
    store
      .getState()
      .applyChunk({
        type: "text-delta",
        id: "t1",
        delta: "Hi",
      } as UIMessageChunk);
    store
      .getState()
      .applyChunk({
        type: "text-delta",
        id: "t1",
        delta: " there",
      } as UIMessageChunk);
    store.getState().finishTurn([{ role: "assistant", content: "Hi there" }]);

    const state = store.getState();
    expect(state.transcript.length).toBe(2);
    expect(state.transcript[0]?.role).toBe("user");
    expect(state.transcript[1]?.text).toBe("Hi there");
    expect(state.isStreaming).toBe(false);
  });

  test("caps debug and tool ring buffers", () => {
    const store = createTuiStore({
      initialMessages: [],
      debugEnabled: true,
    });

    for (let i = 0; i < 450; i += 1) {
      store
        .getState()
        .applyChunk({
          type: "text-delta",
          id: "x",
          delta: `part-${i}`,
        } as UIMessageChunk);
    }

    for (let i = 0; i < 220; i += 1) {
      store
        .getState()
        .applyChunk({
          type: "tool-input-start",
          toolName: `tool-${i}`,
          toolCallId: `call-${i}`,
        } as UIMessageChunk);
    }

    const state = store.getState();
    expect(state.debugEvents.length).toBe(400);
    expect(state.toolEvents.length).toBe(200);
  });
});
