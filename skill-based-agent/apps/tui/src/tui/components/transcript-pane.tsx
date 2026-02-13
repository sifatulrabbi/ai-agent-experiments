import { Box, Text } from "ink";
import { type ReactElement } from "react";
import { useStore } from "zustand";

import { type TuiStore, type TranscriptEntry } from "../store";

interface TranscriptPaneProps {
  store: TuiStore;
}

const MAX_RESERVED_LAYOUT_ROWS = 8;

interface RenderLine {
  text: string;
  role?: TranscriptEntry["role"];
  header?: boolean;
}

function roleColor(
  role: TranscriptEntry["role"],
): "cyan" | "green" | "yellow" | "magenta" {
  switch (role) {
    case "user":
      return "cyan";
    case "assistant":
      return "green";
    case "system":
      return "yellow";
    case "tool":
      return "magenta";
  }
}

export function TranscriptPane({ store }: TranscriptPaneProps): ReactElement {
  const transcript = useStore(store, (state) => state.transcript);
  const composing = useStore(store, (state) => state.composingAssistantText);
  const terminalWidth = process.stdout.columns ?? 120;
  const terminalHeight = process.stdout.rows ?? 40;

  const inspectorWidth = 48;
  const panePadding = 8;
  const availableWidth = Math.max(
    24,
    terminalWidth - inspectorWidth - panePadding,
  );
  const availableRows = Math.max(10, terminalHeight - MAX_RESERVED_LAYOUT_ROWS);

  const wrapToWidth = (value: string): string[] => {
    const source = value.length > 0 ? value : " ";
    const rows: string[] = [];
    for (let i = 0; i < source.length; i += availableWidth) {
      rows.push(source.slice(i, i + availableWidth));
    }
    return rows.length > 0 ? rows : [" "];
  };

  const allLines: RenderLine[] = [];
  for (const message of transcript) {
    const label =
      message.role === "user"
        ? "You"
        : message.role === "assistant"
          ? "Agent"
          : message.role;
    allLines.push({ text: label, role: message.role, header: true });
    const contentLines = message.text.split("\n");
    for (const rawLine of contentLines) {
      for (const wrapped of wrapToWidth(rawLine)) {
        allLines.push({ text: wrapped, role: message.role });
      }
    }
    allLines.push({ text: "" });
  }

  if (composing) {
    allLines.push({
      text: "Agent (streaming)",
      role: "assistant",
      header: true,
    });
    for (const rawLine of composing.split("\n")) {
      for (const wrapped of wrapToWidth(rawLine)) {
        allLines.push({ text: wrapped, role: "assistant" });
      }
    }
  }

  const visibleLines = allLines.slice(-availableRows);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      paddingY={1}
      minWidth={60}
    >
      <Text bold color="white">
        Conversation
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {visibleLines.length === 0 ? (
          <Text dimColor>Start by typing a message below.</Text>
        ) : (
          visibleLines.map((line, index) => (
            <Text
              key={`line-${index}`}
              color={line.role ? roleColor(line.role) : undefined}
              bold={line.header}
              dimColor={!line.header && !line.text}
            >
              {line.text}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}
