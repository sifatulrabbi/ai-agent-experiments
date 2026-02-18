import {
  createOpenRouter,
  OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import { tavilySearch, tavilyExtract } from "@tavily/ai-sdk";
import { consoleLogger } from "@protean/logger";
import { type Skill } from "@protean/skill";
import { WorkspaceSkill } from "@protean/workspace-skill";
import { createDocxConverter, DocxSkill } from "@protean/docx-skill";
import { PptxSkill } from "@protean/pptx-skill";
import { createStubPptxConverter } from "@protean/pptx-skill";
import { XlsxSkill } from "@protean/xlsx-skill";
import { createStubXlsxConverter } from "@protean/xlsx-skill";
import { ResearchSkill } from "@protean/research-skill";

import { createOrchestration } from "./orchestration";
import { createFS } from "./services/fs";
import { createSubAgent } from "./services/sub-agent";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";
import {
  convertToModelMessages,
  tool,
  type ToolLoopAgent,
  type UIMessage,
} from "ai";
import z from "zod";
import type {
  CompactThreadOptions,
  CompactionPolicy,
  FsMemory,
  ThreadMessageRecord,
  ThreadModelSelection,
} from "@protean/agent-memory";

const webSearchTools = {
  WebSearchGeneral: tavilySearch({
    searchDepth: "basic",
    includeAnswer: true,
    maxResults: 10,
    topic: "general",
  }),
  WebSearchNews: tavilySearch({
    searchDepth: "basic",
    includeAnswer: true,
    maxResults: 10,
    topic: "news",
  }),
  WebFetchUrlContent: tavilyExtract({
    extractDepth: "basic",
    format: "markdown",
  }),
};

export type RootAgentRuntimeProvider = "openrouter";

export interface RootAgentConfig {
  modelId: string;
  reasoningBudget: string;
  runtimeProvider: string;
}

export interface RootAgentMemoryConfig {
  memory: FsMemory;
  compactionPolicy: CompactionPolicy;
  summarizeHistory: (history: ThreadMessageRecord[]) => Promise<UIMessage>;
}

export interface RootAgentThreadStreamOptions {
  modelSelection?: ThreadModelSelection;
  memory?: RootAgentMemoryConfig;
}

export interface RootAgentRuntime {
  stream: ToolLoopAgent["stream"];
  streamThread: (args: {
    threadId: string;
    uiMessages: UIMessage[];
    options?: RootAgentThreadStreamOptions;
  }) => Promise<{
    stream: Awaited<ReturnType<ToolLoopAgent["stream"]>>;
    persistFinish: (messages: UIMessage[]) => Promise<void>;
  }>;
}

const logger = consoleLogger;

function buildModel(config: RootAgentConfig) {
  if (config.runtimeProvider !== "openrouter") {
    throw new Error(`Unsupported runtime provider: ${config.runtimeProvider}`);
  }

  consoleLogger.debug("Model config:", config);
  consoleLogger.debug(process.env.OPENROUTER_API_KEY || "No API key!");

  const openRouterProvider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL || "http://localhost:3004",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "protean-chatapp",
    },
  });

  let reasoning: OpenRouterProviderOptions["reasoning"] = {
    enabled: false,
    effort: "none",
  };

  if (config.reasoningBudget !== "none") {
    reasoning = {
      enabled: true,
      effort: config.reasoningBudget as "high" | "medium" | "low" | "none",
    };
  }

  return openRouterProvider(config.modelId, {
    reasoning,
  });
}

export async function createRootAgent(
  config: RootAgentConfig = {
    modelId: "moonshotai/kimi-k2.5",
    reasoningBudget: "medium",
    runtimeProvider: "openrouter",
  },
): Promise<RootAgentRuntime> {
  const fs = await createFS(
    "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project",
  );

  const skills: Skill<unknown>[] = [
    new WorkspaceSkill({ fsClient: fs, logger }),
    new DocxSkill({
      fsClient: fs,
      converter: createDocxConverter(fs, "/tmp/converted-docx-files/", logger),
      logger,
    }),
    new PptxSkill({
      fsClient: fs,
      converter: createStubPptxConverter(
        fs,
        "/tmp/converted-pptx-files/",
        logger,
      ),
      logger,
    }),
    new XlsxSkill({
      fsClient: fs,
      converter: createStubXlsxConverter(
        fs,
        "/tmp/converted-xlsx-files/",
        logger,
      ),
      logger,
    }),
    new ResearchSkill({ logger }),
  ];

  const subAgentService = await createSubAgent(skills, logger, webSearchTools);
  const subAgentTools = {
    SpawnSubAgent: tool({
      description:
        "Launch a focused sub-agent with a specific set of skills to accomplish a goal. Sub-agents run independently and return their output when finished.",
      inputSchema: z.object({
        skillIds: z
          .array(z.string())
          .describe("Which skills the sub-agent should have access to."),
        goal: z
          .string()
          .describe("The focused task for the sub-agent to accomplish."),
        systemPrompt: z
          .string()
          .optional()
          .describe(
            "Optional custom system prompt override for the sub-agent.",
          ),
        outputStrategy: z
          .enum(["string", "workspace-file", "tmp-file"])
          .describe("How the sub-agent should return its output."),
      }),
      execute: async (args) => {
        const result = await subAgentService.spawn({
          skillIds: args.skillIds,
          goal: args.goal,
          systemPrompt: args.systemPrompt,
          outputStrategy: args.outputStrategy,
        });
        return {
          status: "done",
          output: result.output,
          outputPath: result.outputPath,
        };
      },
    }),
  };

  const agent = await createOrchestration(
    {
      agentId: "root-agent",
      model: buildModel(config),
      instructionsBuilder: buildRootAgentPrompt,
      skillsRegistry: skills,
      tools: { ...webSearchTools, ...subAgentTools },
    },
    logger,
  );

  async function streamThread(args: {
    threadId: string;
    uiMessages: UIMessage[];
    options?: RootAgentThreadStreamOptions;
  }) {
    const memoryConfig = args.options?.memory;
    if (!memoryConfig) {
      const stream = await agent.stream({
        messages: await convertToModelMessages(args.uiMessages),
      });
      return {
        stream,
        persistFinish: async () => {},
      };
    }

    const { memory, compactionPolicy, summarizeHistory } = memoryConfig;
    const thread = await memory.getThread(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    const persistedIds = new Set(thread.history.map((item) => item.message.id));
    const newlySubmittedMessages = args.uiMessages.filter(
      (message) => !persistedIds.has(message.id),
    );

    for (const message of newlySubmittedMessages) {
      await memory.saveMessage(args.threadId, {
        message,
        modelSelection: args.options?.modelSelection ?? thread.modelSelection,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalDurationMs: 0,
        },
      });
    }

    await memory.compactIfNeeded(args.threadId, {
      policy: compactionPolicy,
      summarizeHistory,
    } satisfies CompactThreadOptions);

    const hydratedThread = await memory.getThread(args.threadId);
    if (!hydratedThread) {
      throw new Error(`Thread not found after compaction: ${args.threadId}`);
    }

    const streamStartMs = Date.now();
    const stream = await agent.stream({
      messages: await convertToModelMessages(
        hydratedThread.activeHistory.map((record) => record.message),
      ),
    });

    async function persistFinish(messages: UIMessage[]): Promise<void> {
      const reloaded = await memory.getThread(args.threadId);
      if (!reloaded) {
        return;
      }

      const existingIds = new Set(
        reloaded.history.map((item) => item.message.id),
      );
      const toPersist = messages.filter(
        (message) => !existingIds.has(message.id),
      );
      if (toPersist.length === 0) {
        return;
      }

      const usage = await stream.usage;
      const duration = Math.max(Date.now() - streamStartMs, 0);

      for (let index = 0; index < toPersist.length; index += 1) {
        const message = toPersist[index];
        if (!message) {
          continue;
        }

        await memory.saveMessage(args.threadId, {
          message,
          modelSelection:
            args.options?.modelSelection ?? reloaded.modelSelection,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            totalDurationMs: duration ?? 0,
          },
        });
      }
    }

    return {
      stream,
      persistFinish,
    };
  }

  return {
    stream: agent.stream.bind(agent),
    streamThread,
  };
}
