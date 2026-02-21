import { tool, type LanguageModel, type Tool } from "ai";
import type { Skill } from "@protean/skill";
import type { Logger } from "@protean/logger";

import { createSkillOrchestrator } from "../skill-orchestrator";
import { buildSubAgentSystemPrompt } from "../prompts/sub-agent-prompt";
import z from "zod";

export type OutputStrategy = "string" | "workspace-file" | "tmp-file";

export interface SubAgentDependencies {
  model: LanguageModel;
  skillsList: Skill<unknown>[];
  baseTools?: { [k: string]: Tool };
}

export interface SubAgentConfig {
  skillIds: string[];
  goal: string;
  outputStrategy: OutputStrategy;
  systemPrompt?: string;
}

export interface SubAgentResult {
  output: string;
  outputPath?: string;
}

export interface SubAgentService {
  spawn(config: SubAgentConfig): Promise<SubAgentResult>;
}

function extractOutputPathFromSteps(
  steps: Array<{
    staticToolCalls: Array<{ toolName: string; input: unknown }>;
  }>,
): string | undefined {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    for (let j = step.staticToolCalls.length - 1; j >= 0; j--) {
      const toolCall = step.staticToolCalls[j];
      if (toolCall.toolName !== "WriteFile") {
        continue;
      }

      const input = toolCall.input;
      if (
        typeof input === "object" &&
        input !== null &&
        "path" in input &&
        typeof (input as { path: unknown }).path === "string"
      ) {
        return (input as { path: string }).path;
      }
    }
  }

  return undefined;
}

export async function createSubAgent(
  deps: SubAgentDependencies,
  logger: Logger,
): Promise<SubAgentService> {
  const { model, skillsList, baseTools = {} } = deps;

  return {
    spawn: async (cfg: SubAgentConfig): Promise<SubAgentResult> => {
      const agent = await createSkillOrchestrator(
        {
          model: model,
          instructionsBuilder: buildSubAgentSystemPrompt(
            cfg.outputStrategy,
            cfg.systemPrompt,
          ),
          skillsList: skillsList,
          baseTools: baseTools,
        },
        logger,
      );

      const result = await agent.generate({
        messages: [
          {
            role: "user",
            content: `${cfg.goal}\n\n_Use your skills to complete the tasks._`,
          },
        ],
      });

      return {
        output: result.text,
        outputPath: extractOutputPathFromSteps(result.staticToolCalls),
      };
    },
  };
}
export async function createSubAgentTools(
  opts: SubAgentDependencies,
  logger: Logger,
) {
  const subAgentService = await createSubAgent(opts, logger);

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
