import { ChatOpenAIResponses } from "@langchain/openai";
import {
  StateGraph,
  END,
  START,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { executeCodeTool, readDeclarationTool } from "./llmTools";
import { buildSystemPrompt } from "./buildSystemPrompt";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import type { AIMessageChunk } from "@langchain/core/messages";

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});
export type AgentState = typeof StateAnnotation.State;

enum GraphNode {
  LLM = "llm",
  TOOL = "tools",
}

const llmModel = new ChatOpenAIResponses({
  model: "gpt-5.1",
  reasoning: {
    effort: "none",
    summary: "auto",
  },
});

const availableTools = [executeCodeTool, readDeclarationTool];
const toolsNode = new ToolNode(availableTools);

/**
 * Determines whether to continue to tools or end the conversation
 */
function shouldContinue(state: AgentState): "tools" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    return END;
  }

  if (
    lastMessage.type === "ai" &&
    (
      (lastMessage as AIMessageChunk).tool_calls ||
      (lastMessage as AIMessageChunk).tool_call_chunks ||
      []
    ).length > 0
  ) {
    return GraphNode.TOOL;
  }

  return END;
}

async function llmCallNode(state: AgentState) {
  try {
    const systemPromptText = await buildSystemPrompt();
    const res = await llmModel
      .bindTools(availableTools)
      .invoke([new SystemMessage(systemPromptText), ...state.messages]);
    return {
      messages: [res],
    };
  } catch (err) {
    console.error(err);
    return {
      messages: [new AIMessage({ content: String(err) })],
    };
  }
}

export const agent = new StateGraph(StateAnnotation)
  .addNode(GraphNode.LLM, llmCallNode)
  .addNode(GraphNode.TOOL, toolsNode)
  .addEdge(START, GraphNode.LLM)
  .addConditionalEdges(GraphNode.LLM, shouldContinue)
  .addEdge(GraphNode.TOOL, GraphNode.LLM)
  .compile();
