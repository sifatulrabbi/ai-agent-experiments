import { openrouter } from "@openrouter/ai-sdk-provider";
import { createAgent } from "../orchestrator";
import { consoleLogger } from "../logger";
import { buildSubAgentSystemPrompt } from "../prompts/sub-agent-prompt";
import { SkillDefinition } from "../skills/base";

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
  skillsRegistry: SkillDefinition<unknown>[],
): Promise<SubAgentService> {
  return {
    spawn: async (cfg: SubAgentConfig): Promise<SubAgentResult> => {
      const agent = await createAgent(
        {
          model: openrouter("stepfun/step-3.5-flash:free", {
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
        consoleLogger,
      );

      const result = await agent.generate({
        messages: [
          {
            role: "user",
            content: `Your goal is:\n${cfg.goal}\n\nUse your skills to achieve the goals.`,
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
