import { ChatOpenAIResponses } from "@langchain/openai";
import {
  HumanMessage,
  type MessageStructure,
  type AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import * as readline from "readline";

const llm = new ChatOpenAIResponses({
  model: "gpt-5.1",
  reasoning: {
    effort: "none",
  },
  streaming: true,
});

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

    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    history.push(new HumanMessage({ content: input }));
    process.stdout.write("Assistant: ");

    try {
      let response: AIMessageChunk<MessageStructure> | null = null;
      const stream = await llm.stream(history);

      for await (const chunk of stream) {
        if (response) {
          response = response.concat(chunk);
        } else {
          response = chunk;
        }

        for (const block of chunk.contentBlocks) {
          if (block.reasoning) {
            process.stdout.write((block.reasoning as string) || "");
          }
          if (block.text) {
            process.stdout.write((block.text as string) || "");
          }
        }
      }

      if (response) {
        history.push(response);
      }

      console.log("\n");
    } catch (err) {
      console.error("\nError:", err);
    }

    chat();
  });
}

console.log(
  "Chat CLI (type 'exit' or 'quit' to end, or press Enter on empty line)\n",
);
chat();
