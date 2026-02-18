import type {
  AssistantModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from "ai";

export interface PromptVarsDefault {
  verbosity?: string;
  personality?: string;
}

export interface AgentFactoryConfig {
  reasoningBudget?: string;
  outputVerbosity?: string;
  instructions?: PromptVarsDefault;
}

export interface Thread {
  id: string;
  userId: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  archivedAt: string | null;
  title: string;
  runs: ThreadRun[];
  modelConfig: unknown;
}

export interface ThreadRun {
  id: string;
  createdAt: string;
  finishedAt: string;
  messages: (AssistantModelMessage | UserModelMessage | ToolModelMessage)[];
}
