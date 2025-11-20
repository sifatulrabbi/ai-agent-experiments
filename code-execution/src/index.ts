import * as readline from "readline";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { agent, type AgentState } from "./agent";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history: BaseMessage[] = [];

async function chat() {
  rl.question("You: ", async (input) => {
    if (!input.trim()) {
      rl.close();
      return;
    }

    switch (input.toLowerCase()) {
      case "quit":
      case "exit":
        console.log("Goodbye!");
        rl.close();
        return;
    }

    history.push(new HumanMessage({ content: input }));
    process.stdout.write("Assistant: ");

    let updatedState: AgentState | null = null;

    try {
      const stream = await agent.stream(
        { messages: history },
        { streamMode: ["messages", "values"] },
      );

      for await (const [chunkType, chunk] of stream) {
        if (chunkType === "values") {
          updatedState = chunk;
        } else if (chunkType === "messages") {
          const [msgChunk] = chunk;
          msgChunk.contentBlocks.forEach((block) => {
            if (typeof block.reasoning === "string" && block.reasoning.trim()) {
              process.stdout.write(block.reasoning);
            }
            if (typeof block.text === "string" && block.text.trim()) {
              process.stdout.write(block.text);
            }
          });
        }
      }

      if (updatedState) {
        history.push(...updatedState.messages);
      }
      console.log("\n");
    } catch (err) {
      console.error("\nError:", err);
    }

    void chat();
  });
}

console.log(
  "Chat CLI (type 'exit' or 'quit' to end, or press Enter on empty line)\n",
);

void chat();
