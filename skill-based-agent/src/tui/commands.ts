import { type MessageStore } from "../messages";
import { type TuiStore } from "./store";

interface CommandContext {
  store: TuiStore;
  messageStore: MessageStore;
  onExit: () => void;
}

function splitCommand(input: string): { command: string; argument: string } {
  const [command, ...rest] = input.trim().split(/\s+/);
  return {
    command: (command ?? "").toLowerCase(),
    argument: rest.join(" "),
  };
}

export async function handleSlashCommand(
  input: string,
  ctx: CommandContext,
): Promise<boolean> {
  if (!input.startsWith("/")) {
    return false;
  }

  const { command } = splitCommand(input.slice(1));
  const state = ctx.store.getState();

  switch (command) {
    case "help":
      state.setMode("help");
      state.setStatus("Commands: /help /clear /history /debug /exit");
      return true;
    case "clear":
      state.clearConversation();
      await ctx.messageStore.save([]);
      return true;
    case "history": {
      const turns = state.transcript.length;
      const modelMessages = state.history.length;
      state.setStatus(
        `History: ${turns} transcript entries, ${modelMessages} model messages`,
      );
      return true;
    }
    case "debug":
      state.toggleDebug();
      return true;
    case "exit":
    case "quit":
      ctx.onExit();
      return true;
    default:
      state.setStatus(`Unknown command: /${command}`);
      return true;
  }
}
