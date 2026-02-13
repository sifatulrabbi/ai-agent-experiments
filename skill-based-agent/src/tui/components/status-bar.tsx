import { Box, Text } from "ink";
import { type ReactElement } from "react";
import { useStore } from "zustand";

import { type TuiStore } from "../store";

interface StatusBarProps {
  store: TuiStore;
}

export function StatusBar({ store }: StatusBarProps): ReactElement {
  const status = useStore(store, (state) => state.status);
  const isStreaming = useStore(store, (state) => state.isStreaming);
  const error = useStore(store, (state) => state.error);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      <Text color={error ? "red" : isStreaming ? "yellow" : "green"}>
        {error ? `Error: ${error}` : `Status: ${status}`}
      </Text>
      <Text dimColor> | /help /clear /history /debug /exit</Text>
    </Box>
  );
}
