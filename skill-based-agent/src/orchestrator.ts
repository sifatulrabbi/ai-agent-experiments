import {
  tool,
  generateText,
  stepCountIs,
  type Tool,
  type LanguageModel,
} from "ai";
import z from "zod";

import { ToolCollisionError, UnknownSkillError, type AppError } from "./errors";
import { type Logger, noopLogger } from "./logger";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";
import { type SkillDefinition, type SkillId } from "./skills/base";
import { resolveSkillLoadOrder } from "./skills/resolve-skill-dependencies";

interface SkillLoadSuccess {
  ok: true;
  instructions: string;
  loadedSkillIds: SkillId[];
}

interface SkillLoadFailure {
  ok: false;
  error: AppError;
}

type SkillLoadResult = SkillLoadSuccess | SkillLoadFailure;

export interface OrchestratorConfig {
  skills: SkillDefinition<unknown>[];
  logger?: Logger;
  maxSteps?: number;
}

export class AgentOrchestrator {
  private readonly skillRegistry: Map<string, SkillDefinition<unknown>> =
    new Map();
  private readonly loadedSkillIds: Set<string> = new Set();
  private readonly allTools: Record<string, Tool> = {};
  private readonly skillToolNames: Map<string, string[]> = new Map();
  private readonly logger: Logger;
  private readonly maxSteps: number;

  constructor(config: OrchestratorConfig) {
    this.logger = config.logger ?? noopLogger;
    this.maxSteps = config.maxSteps ?? 50;

    for (const skill of config.skills) {
      this.skillRegistry.set(skill.id, skill);

      const toolNames: string[] = [];
      for (const [name, t] of Object.entries(skill.tools)) {
        if (this.allTools[name]) {
          throw new ToolCollisionError(name);
        }
        this.allTools[name] = t;
        toolNames.push(name);
      }
      this.skillToolNames.set(skill.id, toolNames);
    }
  }

  private tryLoadSkill(id: string): SkillLoadResult {
    if (this.loadedSkillIds.has(id)) {
      return {
        ok: true,
        instructions: `Skill "${id}" is already loaded.`,
        loadedSkillIds: [],
      };
    }

    const resolveResult = resolveSkillLoadOrder(this.skillRegistry, [id]);
    if (!resolveResult.ok) {
      return { ok: false, error: resolveResult.error };
    }

    const newlyLoadedIds: SkillId[] = [];
    const instructionParts: string[] = [];

    for (const skillId of resolveResult.order) {
      if (this.loadedSkillIds.has(skillId)) {
        continue;
      }

      const skill = this.skillRegistry.get(skillId);
      if (!skill) {
        return {
          ok: false,
          error: new UnknownSkillError(skillId, [...this.skillRegistry.keys()]),
        };
      }

      this.logger.debug(`Loading skill=${skillId}`);
      this.loadedSkillIds.add(skillId);
      newlyLoadedIds.push(skillId);
      instructionParts.push(skill.instructions);
    }

    return {
      ok: true,
      instructions: instructionParts.join("\n\n---\n\n"),
      loadedSkillIds: newlyLoadedIds,
    };
  }

  loadSkill(id: string): string {
    const result = this.tryLoadSkill(id);
    if (!result.ok) {
      return `Error [${result.error.code}]: ${result.error.message}`;
    }

    if (result.instructions.length === 0) {
      return `Skill "${id}" is already loaded.`;
    }

    return result.instructions;
  }

  getActiveToolNames(): string[] {
    const names: string[] = ["Skill"];
    for (const id of this.loadedSkillIds) {
      const toolNames = this.skillToolNames.get(id);
      if (toolNames) {
        names.push(...toolNames);
      }
    }
    return names;
  }

  getLoadedSkillIds(): string[] {
    return [...this.loadedSkillIds];
  }

  getSkillFrontmatters(): { id: string; frontmatter: string }[] {
    return [...this.skillRegistry.values()].map((s) => ({
      id: s.id,
      frontmatter: s.frontmatter,
    }));
  }

  buildToolSet(): Record<string, Tool> {
    const SkillTool = tool({
      description:
        "Load a skill to activate its tools and receive usage instructions. Pass the skill ID from the Available Skills list.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The skill ID to load (e.g. 'workspace-skill')."),
      }),
      execute: async ({ id }) => this.loadSkill(id),
    });

    return { Skill: SkillTool, ...this.allTools };
  }

  async run(opts: { model: LanguageModel; userMessage: string }): Promise<{
    text: string;
    steps: Array<{
      toolCalls: Array<{ toolName: string }>;
      finishReason: string;
    }>;
  }> {
    const tools = this.buildToolSet();
    let stepCounter = 0;

    const result = await generateText({
      model: opts.model,
      system: buildRootAgentPrompt(this.getSkillFrontmatters()),
      tools,
      prompt: opts.userMessage,
      prepareStep: async () => ({
        activeTools: this.getActiveToolNames(),
      }),
      stopWhen: stepCountIs(this.maxSteps),
      onStepFinish: ({ toolCalls, finishReason }) => {
        const toolNames = toolCalls.map((tc) => tc.toolName);
        this.logger.info(
          `Step ${stepCounter}: toolCalls=${JSON.stringify(toolNames)} finishReason=${finishReason}`,
        );
        stepCounter++;
      },
    });

    return result;
  }
}
