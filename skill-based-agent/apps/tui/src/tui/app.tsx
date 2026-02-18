import { Box, Text, useApp, useInput } from "ink";
import { type ModelMessage } from "ai";
import { useMemo, useCallback, type ReactElement } from "react";

import { type MessageStore } from "../messages";
import { handleSlashCommand } from "./commands";
import { StatusBar } from "./components/status-bar";
import { PromptInput } from "./components/prompt-input";
import { TranscriptPane } from "./components/transcript-pane";
import { InspectorPane } from "./components/inspector-pane";
import { SplitLayout } from "./components/layout";
import { createTuiStore } from "./store";
import { runStreamTurn, type StreamAgent } from "./stream-adapter";

interface TuiAppProps {
  agent: StreamAgent;
  messageStore: MessageStore;
  initialMessages: ModelMessage[];
  debugStreamDefault: boolean;
}

export function TuiApp(props: TuiAppProps): ReactElement {
  const { exit } = useApp();

  const store = useMemo(
    () =>
      createTuiStore({
        initialMessages: props.initialMessages,
        debugEnabled: props.debugStreamDefault,
      }),
    [props.initialMessages, props.debugStreamDefault],
  );

  useInput((inputValue, key) => {
    if (key.ctrl && inputValue.toLowerCase() === "c") {
      exit();
    }
  });

  const onSubmit = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim();
      if (!value) {
        return;
      }

      store.getState().setInput("");

      void (async () => {
        const wasCommand = await handleSlashCommand(value, {
          store,
          messageStore: props.messageStore,
          onExit: exit,
        });

        if (wasCommand) {
          return;
        }

        await runStreamTurn({
          agent: props.agent,
          store,
          messageStore: props.messageStore,
          userText: value,
        });
      })();
    },
    [exit, props.agent, props.messageStore, store],
  );

  return (
    <Box flexDirection="column" height={process.stdout.rows || 40}>
      <Text bold color="white">
        Skill-Based Agent TUI
      </Text>
      <SplitLayout>
        <TranscriptPane store={store} />
        <InspectorPane store={store} />
      </SplitLayout>
      <StatusBar store={store} />
      <PromptInput store={store} onSubmit={onSubmit} />
    </Box>
  );
}
