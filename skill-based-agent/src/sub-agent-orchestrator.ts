import { generateText, stepCountIs, type Tool, type LanguageModel } from "ai";

import { ToolCollisionError } from "./errors";
import { type Logger, noopLogger } from "./logger";
import { buildSubAgentSystemPrompt } from "./prompts/sub-agent-prompt";
import {
  type SubAgentService,
  type SubAgentConfig,
  type SubAgentResult,
} from "./services/sub-agent";
import { type SkillDefinition, type SkillId } from "./skills/base";
import { resolveSkillLoadOrder } from "./skills/resolve-skill-dependencies";

export interface SubAgentOrchestratorConfig {
  skills: SkillDefinition<unknown>[];
  model: LanguageModel;
  logger?: Logger;
  maxSteps?: number;
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

/**
 * Creates a real SubAgentService that spawns sub-agents as generateText loops.
 * Each sub-agent gets the requested skills pre-loaded - all tools are active
 * from step 0, no Skill tool is needed.
 */
export function createSubAgentOrchestrator(
  opts: SubAgentOrchestratorConfig,
): SubAgentService {
  const skillMap = new Map<SkillId, SkillDefinition<unknown>>(
    opts.skills.map((s) => [s.id, s]),
  );
  const logger = opts.logger ?? noopLogger;
  const maxSteps = opts.maxSteps ?? 20;

  return {
    async spawn(config: SubAgentConfig): Promise<SubAgentResult> {
      const resolveResult = resolveSkillLoadOrder(skillMap, config.skillIds);
      if (!resolveResult.ok) {
        return {
          output: `Error [${resolveResult.error.code}]: ${resolveResult.error.message}`,
        };
      }

      const tools: Record<string, Tool> = {};
      const instructions: string[] = [];

      for (const id of resolveResult.order) {
        const skill = skillMap.get(id);
        if (!skill) {
          continue;
        }

        for (const [toolName, toolDef] of Object.entries(skill.tools)) {
          if (tools[toolName]) {
            throw new ToolCollisionError(toolName);
          }
          tools[toolName] = toolDef;
        }

        instructions.push(skill.instructions);
      }

      logger.info(
        `[sub-agent] Spawning with skills=[${resolveResult.order.join(", ")}] goal="${config.goal.slice(0, 80)}"`,
      );

      const result = await generateText({
        model: opts.model,
        system: buildSubAgentSystemPrompt(
          instructions,
          config.outputStrategy,
          config.systemPrompt,
        ),
        tools,
        prompt: config.goal,
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: ({ toolCalls, finishReason }) => {
          const toolNames = toolCalls.map((tc) => tc.toolName);
          logger.info(
            `[sub-agent] step: toolCalls=${JSON.stringify(toolNames)} finishReason=${finishReason}`,
          );
        },
      });

      const outputPath =
        config.outputStrategy === "string"
          ? undefined
          : extractOutputPathFromSteps(result.steps);

      return { output: result.text, outputPath };
    },
  };
}

export { extractOutputPathFromSteps };
