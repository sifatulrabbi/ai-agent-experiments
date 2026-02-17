import { openrouter } from "@openrouter/ai-sdk-provider";
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
import { tool } from "ai";
import z from "zod";

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
export type RootAgentReasoningBudget = "none" | "low" | "medium" | "high";

export interface RootAgentConfig {
  modelId: string;
  reasoningBudget: RootAgentReasoningBudget;
  runtimeProvider: string;
}

const logger = consoleLogger;

function buildModel(config: RootAgentConfig) {
  if (config.runtimeProvider !== "openrouter") {
    throw new Error(`Unsupported runtime provider: ${config.runtimeProvider}`);
  }

  consoleLogger.debug("Model config:", config);

  return openrouter(config.modelId, {
    reasoning: {
      effort: config.reasoningBudget,
    },
  });
}

export async function createRootAgent(
  config: RootAgentConfig = {
    modelId: "moonshotai/kimi-k2.5",
    reasoningBudget: "medium",
    runtimeProvider: "openrouter",
  },
) {
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

  return createOrchestration(
    {
      model: buildModel(config),
      instructionsBuilder: buildRootAgentPrompt,
      skillsRegistry: skills,
      tools: { ...webSearchTools, ...subAgentTools },
    },
    logger,
  );
}
