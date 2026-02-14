import { Box, Text } from "ink";
import { type ReactElement } from "react";
import { useStore } from "zustand";

import { type TuiStore } from "../store";

interface InspectorPaneProps {
  store: TuiStore;
}

const INSPECTOR_WIDTH = 48;
const MAX_RESERVED_LAYOUT_ROWS = 8;

function statusColor(
  status: string,
): "blue" | "yellow" | "green" | "red" | "gray" {
  switch (status) {
    case "input":
      return "blue";
    case "called":
      return "yellow";
    case "done":
      return "green";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

export function InspectorPane({ store }: InspectorPaneProps): ReactElement {
  const toolEvents = useStore(store, (state) => state.toolEvents);
  const debugEnabled = useStore(store, (state) => state.debugEnabled);
  const debugEvents = useStore(store, (state) => state.debugEvents);

  const terminalHeight = process.stdout.rows ?? 40;
  const availableRows = Math.max(10, terminalHeight - MAX_RESERVED_LAYOUT_ROWS);
  const textWidth = Math.max(20, INSPECTOR_WIDTH - 6);

  const wrapToWidth = (value: string): string[] => {
    const source = value.length > 0 ? value : " ";
    const rows: string[] = [];
    for (let i = 0; i < source.length; i += textWidth) {
      rows.push(source.slice(i, i + textWidth));
    }
    return rows.length > 0 ? rows : [" "];
  };

  type InspectorLine = {
    text: string;
    color?: ReturnType<typeof statusColor>;
    dim?: boolean;
    title?: boolean;
  };
  const lines: InspectorLine[] = [{ text: "Tool Calls", title: true }];

  if (toolEvents.length === 0) {
    lines.push({ text: "No tool activity", dim: true });
  } else {
    const recentTools = toolEvents.slice(-16);
    for (const event of recentTools) {
      lines.push({
        text: `${event.toolName} [${event.status}]`,
        color: statusColor(event.status),
      });
      if (event.outputPreview) {
        for (const wrapped of wrapToWidth(event.outputPreview)) {
          lines.push({ text: wrapped, dim: true });
        }
      }
      lines.push({ text: "" });
    }
  }

  if (debugEnabled) {
    lines.push({ text: "Raw Stream", title: true });
    if (debugEvents.length === 0) {
      lines.push({ text: "No stream events yet", dim: true });
    } else {
      const recentDebug = debugEvents.slice(-24);
      for (const debugLine of recentDebug) {
        for (const wrapped of wrapToWidth(debugLine)) {
          lines.push({ text: wrapped, dim: true });
        }
      }
    }
  }

  const visibleLines = lines.slice(-availableRows);

  return (
    <Box
      flexDirection="column"
      width={INSPECTOR_WIDTH}
      borderLeft
      borderColor="gray"
      paddingX={1}
      paddingY={1}
      minHeight={16}
    >
      <Text bold color="white">
        Inspector
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {visibleLines.map((line, index) => (
          <Text
            key={`inspector-line-${index}`}
            color={line.title ? "white" : line.color}
            bold={line.title}
            dimColor={line.dim}
          >
            {line.text}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
