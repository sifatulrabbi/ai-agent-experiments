import { openrouter } from "@openrouter/ai-sdk-provider";
import { type Skill } from "@protean/skill";
import { type Logger } from "@protean/logger";

import { createOrchestration } from "../orchestration";
import { buildSubAgentSystemPrompt } from "../prompts/sub-agent-prompt";

export type OutputStrategy = "string" | "workspace-file" | "tmp-file";

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
  skillsRegistry: Skill<unknown>[],
  logger: Logger,
): Promise<SubAgentService> {
  return {
    spawn: async (cfg: SubAgentConfig): Promise<SubAgentResult> => {
      const agent = await createOrchestration(
        {
          // model: openrouter("stepfun/step-3.5-flash:free", {
          model: openrouter("moonshotai/kimi-k2.5", {
            reasoning: {
              enabled: true,
              effort: "medium",
            },
          }),
          instructionsBuilder: buildSubAgentSystemPrompt(
            cfg.outputStrategy,
            cfg.systemPrompt,
          ),
          skillsRegistry,
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
