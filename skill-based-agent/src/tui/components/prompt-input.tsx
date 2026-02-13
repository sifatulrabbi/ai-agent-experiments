import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { type ReactElement } from "react";
import { useStore } from "zustand";

import { type TuiStore } from "../store";

interface PromptInputProps {
  store: TuiStore;
  onSubmit: (value: string) => void;
}

export function PromptInput({
  store,
  onSubmit,
}: PromptInputProps): ReactElement {
  const value = useStore(store, (state) => state.inputValue);
  const isStreaming = useStore(store, (state) => state.isStreaming);

  return (
    <Box marginTop={1}>
      <Text color="cyan">{isStreaming ? "…" : ">"} </Text>
      <TextInput
        value={value}
        onChange={(nextValue) => store.getState().setInput(nextValue)}
        onSubmit={(submittedValue) => onSubmit(submittedValue)}
        placeholder={
          isStreaming
            ? "Waiting for current response..."
            : "Ask something or use /help"
        }
      />
    </Box>
  );
}
