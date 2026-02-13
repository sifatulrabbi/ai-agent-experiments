import { describe, expect, test, mock } from "bun:test";

import { handleSlashCommand } from "../../tui/commands";
import { createTuiStore } from "../../tui/store";

describe("handleSlashCommand", () => {
  test("returns false for non-command input", async () => {
    const store = createTuiStore({ initialMessages: [], debugEnabled: false });
    const handled = await handleSlashCommand("hello", {
      store,
      messageStore: {
        load: async () => [],
        save: async () => undefined,
      },
      onExit: () => undefined,
    });

    expect(handled).toBe(false);
  });

  test("toggles debug and clears history", async () => {
    const store = createTuiStore({ initialMessages: [], debugEnabled: false });
    const save = mock(async () => undefined);

    await handleSlashCommand("/debug", {
      store,
      messageStore: { load: async () => [], save },
      onExit: () => undefined,
    });

    expect(store.getState().debugEnabled).toBe(true);

    store.getState().startTurn("hello");
    await handleSlashCommand("/clear", {
      store,
      messageStore: { load: async () => [], save },
      onExit: () => undefined,
    });

    expect(store.getState().history.length).toBe(0);
    expect(save).toHaveBeenCalled();
  });

  test("exits on /exit", async () => {
    const store = createTuiStore({ initialMessages: [], debugEnabled: false });
    const onExit = mock(() => undefined);

    await handleSlashCommand("/exit", {
      store,
      messageStore: {
        load: async () => [],
        save: async () => undefined,
      },
      onExit,
    });

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
