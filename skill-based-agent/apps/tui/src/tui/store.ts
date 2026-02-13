import { type ModelMessage, type UIMessageChunk } from "ai";
import { createStore, type StoreApi } from "zustand/vanilla";

const MAX_DEBUG_EVENTS = 400;
const MAX_TOOL_EVENTS = 200;

export type SessionMode = "normal" | "help";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  pending?: boolean;
}

export interface ToolCallEvent {
  id: string;
  toolName: string;
  status: "input" | "called" | "done" | "error" | "denied";
  inputPreview: string;
  outputPreview: string;
}

export interface TuiState {
  mode: SessionMode;
  status: string;
  error: string | null;
  isStreaming: boolean;
  inputValue: string;
  history: ModelMessage[];
  transcript: TranscriptEntry[];
  composingAssistantText: string;
  composingAssistantId: string | null;
  debugEnabled: boolean;
  debugEvents: string[];
  toolEvents: ToolCallEvent[];
  startTurn(userText: string): void;
  applyChunk(chunk: UIMessageChunk): void;
  finishTurn(responseMessages: ModelMessage[]): void;
  failTurn(errorText: string): void;
  toggleDebug(): void;
  clearConversation(): void;
  loadHistory(messages: ModelMessage[]): void;
  setInput(value: string): void;
  setStatus(value: string): void;
  setMode(mode: SessionMode): void;
}

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function trimForPreview(value: string, max = 100): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function pushBounded<T>(items: T[], value: T, max: number): T[] {
  if (items.length + 1 <= max) {
    return [...items, value];
  }
  return [...items.slice(items.length - (max - 1)), value];
}

function summarizeContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const textParts: string[] = [];

  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      continue;
    }

    const maybeText = (part as { text?: unknown }).text;
    if (typeof maybeText === "string") {
      textParts.push(maybeText);
    }
  }

  return textParts.join("\n");
}

function roleToTranscriptRole(role: string): TranscriptEntry["role"] {
  if (
    role === "user" ||
    role === "assistant" ||
    role === "system" ||
    role === "tool"
  ) {
    return role;
  }
  return "assistant";
}

function messagesToTranscript(messages: ModelMessage[]): TranscriptEntry[] {
  return messages
    .map((message) => {
      const text = summarizeContent(
        (message as { content?: unknown }).content,
      ).trim();
      if (!text) {
        return null;
      }

      return {
        id: nextId("history"),
        role: roleToTranscriptRole(
          (message as { role?: string }).role ?? "assistant",
        ),
        text,
      } satisfies TranscriptEntry;
    })
    .filter((entry): entry is TranscriptEntry => entry !== null);
}

function chunkToDebugLine(chunk: UIMessageChunk): string {
  switch (chunk.type) {
    case "text-delta":
      return `[text] ${trimForPreview(chunk.delta, 60)}`;
    case "reasoning-delta":
      return `[reasoning] ${trimForPreview(chunk.delta, 60)}`;
    case "tool-input-delta":
      return `[tool-input] ${trimForPreview(chunk.inputTextDelta, 60)}`;
    default:
      return `[${chunk.type}]`;
  }
}

function upsertToolEvent(
  current: ToolCallEvent[],
  nextEvent: ToolCallEvent,
): ToolCallEvent[] {
  const index = current.findIndex((item) => item.id === nextEvent.id);
  if (index === -1) {
    return pushBounded(current, nextEvent, MAX_TOOL_EVENTS);
  }

  const cloned = [...current];
  cloned[index] = nextEvent;
  return cloned;
}

export interface CreateTuiStoreConfig {
  initialMessages: ModelMessage[];
  debugEnabled: boolean;
}

export type TuiStore = StoreApi<TuiState>;

export function createTuiStore(config: CreateTuiStoreConfig): TuiStore {
  const initialTranscript = messagesToTranscript(config.initialMessages);

  return createStore<TuiState>((set) => ({
    mode: "normal",
    status: "Ready",
    error: null,
    isStreaming: false,
    inputValue: "",
    history: [...config.initialMessages],
    transcript: initialTranscript,
    composingAssistantText: "",
    composingAssistantId: null,
    debugEnabled: config.debugEnabled,
    debugEvents: [],
    toolEvents: [],

    startTurn: (userText) => {
      set((state) => ({
        isStreaming: true,
        status: "Streaming",
        error: null,
        mode: "normal",
        history: [...state.history, { role: "user", content: userText }],
        transcript: [
          ...state.transcript,
          {
            id: nextId("user"),
            role: "user",
            text: userText,
          },
        ],
        composingAssistantText: "",
        composingAssistantId: null,
      }));
    },

    applyChunk: (chunk) => {
      set((state) => {
        const debugEvents = pushBounded(
          state.debugEvents,
          chunkToDebugLine(chunk),
          MAX_DEBUG_EVENTS,
        );

        switch (chunk.type) {
          case "text-start":
            return {
              debugEvents,
              composingAssistantId: chunk.id,
              status: "Generating response",
            };
          case "text-delta":
            return {
              debugEvents,
              composingAssistantText:
                state.composingAssistantText + chunk.delta,
            };
          case "reasoning-start":
            return {
              debugEvents,
              status: "Reasoning",
            };
          case "tool-input-start": {
            const current = state.toolEvents.find(
              (evt) => evt.id === chunk.toolCallId,
            );
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: chunk.toolName,
              status: "input",
              inputPreview: current?.inputPreview ?? "",
              outputPreview: current?.outputPreview ?? "",
            });

            return {
              debugEvents,
              toolEvents: updated,
              status: `Tool: ${chunk.toolName}`,
            };
          }
          case "tool-input-delta": {
            const current = state.toolEvents.find(
              (evt) => evt.id === chunk.toolCallId,
            );
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: current?.toolName ?? "unknown",
              status: "input",
              inputPreview: trimForPreview(
                `${current?.inputPreview ?? ""}${chunk.inputTextDelta}`,
              ),
              outputPreview: current?.outputPreview ?? "",
            });

            return {
              debugEvents,
              toolEvents: updated,
            };
          }
          case "tool-input-available": {
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: chunk.toolName,
              status: "called",
              inputPreview: trimForPreview(JSON.stringify(chunk.input)),
              outputPreview: "",
            });

            return {
              debugEvents,
              toolEvents: updated,
              status: `Running tool ${chunk.toolName}`,
            };
          }
          case "tool-output-available": {
            const current = state.toolEvents.find(
              (evt) => evt.id === chunk.toolCallId,
            );
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: current?.toolName ?? "unknown",
              status: "done",
              inputPreview: current?.inputPreview ?? "",
              outputPreview: trimForPreview(JSON.stringify(chunk.output)),
            });

            return {
              debugEvents,
              toolEvents: updated,
              status: "Tool completed",
            };
          }
          case "tool-output-error": {
            const current = state.toolEvents.find(
              (evt) => evt.id === chunk.toolCallId,
            );
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: current?.toolName ?? "unknown",
              status: "error",
              inputPreview: current?.inputPreview ?? "",
              outputPreview: trimForPreview(chunk.errorText),
            });

            return {
              debugEvents,
              toolEvents: updated,
              status: "Tool failed",
            };
          }
          case "tool-output-denied": {
            const current = state.toolEvents.find(
              (evt) => evt.id === chunk.toolCallId,
            );
            const updated = upsertToolEvent(state.toolEvents, {
              id: chunk.toolCallId,
              toolName: current?.toolName ?? "unknown",
              status: "denied",
              inputPreview: current?.inputPreview ?? "",
              outputPreview: "Denied",
            });

            return {
              debugEvents,
              toolEvents: updated,
              status: "Tool denied",
            };
          }
          case "error":
            return {
              debugEvents,
              error: chunk.errorText,
              status: "Stream error",
            };
          case "abort":
            return {
              debugEvents,
              status: "Aborted",
            };
          case "finish":
            return {
              debugEvents,
              status: `Finished (${chunk.finishReason ?? "unknown"})`,
            };
          default:
            return {
              debugEvents,
            };
        }
      });
    },

    finishTurn: (responseMessages) => {
      set((state) => {
        const responseText = state.composingAssistantText.trim();

        const assistantEntry: TranscriptEntry | null = responseText
          ? {
              id: nextId("assistant"),
              role: "assistant",
              text: responseText,
            }
          : null;

        const transcript = assistantEntry
          ? [...state.transcript, assistantEntry]
          : state.transcript;

        return {
          isStreaming: false,
          status: "Ready",
          error: null,
          history: [...state.history, ...responseMessages],
          transcript,
          composingAssistantText: "",
          composingAssistantId: null,
        };
      });
    },

    failTurn: (errorText) => {
      set((state) => ({
        isStreaming: false,
        error: errorText,
        status: "Error",
        composingAssistantText: "",
        composingAssistantId: null,
        debugEvents: pushBounded(
          state.debugEvents,
          `[error] ${errorText}`,
          MAX_DEBUG_EVENTS,
        ),
      }));
    },

    toggleDebug: () => {
      set((state) => ({
        debugEnabled: !state.debugEnabled,
        status: state.debugEnabled ? "Debug hidden" : "Debug visible",
      }));
    },

    clearConversation: () => {
      set((state) => ({
        history: [],
        transcript: [],
        composingAssistantText: "",
        composingAssistantId: null,
        toolEvents: [],
        status: "Conversation cleared",
        error: null,
        isStreaming: false,
        debugEvents: state.debugEvents,
      }));
    },

    loadHistory: (messages) => {
      set(() => ({
        history: [...messages],
        transcript: messagesToTranscript(messages),
        composingAssistantText: "",
        composingAssistantId: null,
        status: messages.length > 0 ? "History loaded" : "Ready",
      }));
    },

    setInput: (value) => {
      set(() => ({ inputValue: value }));
    },

    setStatus: (value) => {
      set(() => ({ status: value }));
    },

    setMode: (mode) => {
      set(() => ({ mode }));
    },
  }));
}
