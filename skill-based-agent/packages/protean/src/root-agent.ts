import {
  createOpenRouter,
  type OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";
import { tavilySearch, tavilyExtract } from "@tavily/ai-sdk";
import { tool } from "ai";
import assert from "node:assert";
import z from "zod";
import type { ThreadModelSelection } from "@protean/agent-memory";
import type { Logger } from "@protean/logger";
import type { Skill } from "@protean/skill";
import type { FS } from "@protean/vfs";
import { WorkspaceSkill } from "@protean/workspace-skill";
import { PptxSkill } from "@protean/pptx-skill";
import { XlsxSkill } from "@protean/xlsx-skill";
import { ResearchSkill } from "@protean/research-skill";
import { DocxSkill, createDocxConverter } from "@protean/docx-skill";
import { createStubPptxConverter } from "@protean/pptx-skill";
import { createStubXlsxConverter } from "@protean/xlsx-skill";

import { createOrchestration } from "./orchestration";
import { createSubAgent } from "./services/sub-agent";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";

const webSearchTools = {
  WebSearchGeneral: tavilySearch({
    searchDepth: "basic",
    includeAnswer: true,
    maxResults: 20,
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

export interface RootAgentOpts {
  fs: FS;
  modelSelection: ThreadModelSelection;
}

function buildModel(modelSelection: ThreadModelSelection, logger: Logger) {
  if (modelSelection.providerId === "openrouter") {
    assert(process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY is needed.");

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:3004",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "protean-chatapp",
      },
    });

    logger.debug("Model config:", modelSelection);

    let reasoning: OpenRouterProviderOptions["reasoning"] = {
      enabled: false,
      effort: "none",
    };

    if (modelSelection.reasoningBudget !== "none") {
      reasoning = {
        enabled: true,
        effort: modelSelection.reasoningBudget as
          | "high"
          | "medium"
          | "low"
          | "none",
      };
    }

    return openrouter(modelSelection.modelId, { reasoning });
  }

  throw new Error(`Unsupported runtime provider: ${modelSelection.providerId}`);
}

async function createSkills(opts: RootAgentOpts, logger: Logger) {
  const skills: Skill<unknown>[] = [
    new WorkspaceSkill({ fsClient: opts.fs, logger }),
    new DocxSkill({
      fsClient: opts.fs,
      converter: createDocxConverter(
        opts.fs,
        "/tmp/converted-docx-files/",
        logger,
      ),
      logger,
    }),
    new PptxSkill({
      fsClient: opts.fs,
      converter: createStubPptxConverter(
        opts.fs,
        "/tmp/converted-pptx-files/",
        logger,
      ),
      logger,
    }),
    new XlsxSkill({
      fsClient: opts.fs,
      converter: createStubXlsxConverter(
        opts.fs,
        "/tmp/converted-xlsx-files/",
        logger,
      ),
      logger,
    }),
    new ResearchSkill({ logger }),
  ];

  return skills;
}

async function createSubAgentTools(
  opts: { skills: Skill<unknown>[] },
  logger: Logger,
) {
  const subAgentService = await createSubAgent(
    opts.skills,
    logger,
    webSearchTools,
  );

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

  return subAgentTools;
}

export async function createRootAgent(opts: RootAgentOpts, logger: Logger) {
  // const fs = await createFS(
  //   "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project",
  // );

  const model = buildModel(opts.modelSelection, logger);
  const skills = await createSkills(opts, logger);
  const subAgentTools = await createSubAgentTools({ skills }, logger);
  const agent = await createOrchestration(
    {
      agentId: "protean-agent",
      model: model,
      instructionsBuilder: buildRootAgentPrompt,
      skillsRegistry: skills,
      tools: { ...webSearchTools, ...subAgentTools },
    },
    logger,
  );

  return agent;
}
