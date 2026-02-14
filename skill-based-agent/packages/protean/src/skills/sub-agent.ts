import { tool } from "ai";
import z from "zod";

import { Skill } from "@protean/skill";
import { type Logger } from "@protean/logger";
import { type SubAgentService } from "../services/sub-agent";

export interface SubAgentSkillDeps {
  subAgentService: SubAgentService;
  availableSkillIds: string[];
  logger: Logger;
}

export class SubAgentSkill extends Skill<SubAgentSkillDeps> {
  constructor(dependencies: SubAgentSkillDeps) {
    super(
      {
        id: "sub-agent-skill",
        description:
          "Spawn independent sub-agents that run to completion with a focused goal and a chosen set of skills. Use for parallel work, deep dives, or delegating self-contained subtasks.",
        instructions: `# Sub-agent Skill

You can spawn focused sub-agents to handle specific tasks independently. Each sub-agent is launched with an explicit set of skills and a clear goal, runs to completion, and returns its output.

## Available Tools

### SpawnSubAgent
Launches a new sub-agent with the specified skills and goal. The sub-agent only has access to the skills you explicitly pass - it cannot use tools outside its granted skill set.

Parameters:
- **skillIds** - Array of skill IDs the sub-agent should have (e.g., ["workspace-skill"], ["workspace-skill", "docx-skill"]).
- **goal** - A focused, specific task description for the sub-agent.
- **systemPrompt** - Optional override for the sub-agent's system prompt.
- **outputStrategy** - How the sub-agent returns its result:
  - \`"string"\` - Returns the output directly as a string in the response. Best for short results like summaries, answers, or small code snippets.
  - \`"workspace-file"\` - Writes the output to a file in the workspace and returns the path. Best when the output is a deliverable file the user needs (reports, generated code, documents).
  - \`"tmp-file"\` - Writes the output to a temporary file and returns the path. Best for intermediate results that will be consumed by another step and don't need to persist.

## When to Spawn Sub-agents

- **Parallel compliance checks** - Spawn multiple sub-agents to review different sections of a document simultaneously.
- **File exploration** - Launch a sub-agent with the workspace skill to scan a directory and summarize findings. Tip, launch multiple at once for quick and more accurate results.
- **Template evaluation** - Have a sub-agent generate a file from a template while the root agent continues other work.
- **Document generation** - Delegate report or document creation to a sub-agent with the appropriate document skill.
- **Focused analysis** - Spawn a sub-agent to deeply analyze a single file while the root agent handles the broader task.

## Guidelines

- Compose sub-agents based on user needs - match skill sets to the task at hand.
- Keep goals specific and focused; a sub-agent works best with a clear, narrow objective.
- Choose the right output strategy for the use case: string for inline results, workspace-file for deliverables, tmp-file for intermediate data.
- Sub-agents only have access to the skills explicitly passed to them - they cannot use tools outside their granted set.`,
        dependencies,
      },
      dependencies.logger,
    );
  }

  get tools() {
    return {
      SpawnSubAgent: this.SpawnSubAgent,
    };
  }

  SpawnSubAgent = tool({
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
        .describe("Optional custom system prompt override for the sub-agent."),
      outputStrategy: z
        .enum(["string", "workspace-file", "tmp-file"])
        .describe("How the sub-agent should return its output."),
    }),
    execute: async ({ skillIds, goal, systemPrompt, outputStrategy }) => {
      const { subAgentService, availableSkillIds } = this.dependencies;

      if (skillIds.length === 0) {
        return {
          status: "error",
          error: {
            code: "INVALID_SKILL_IDS",
            message: "skillIds must include at least one skill",
          },
        };
      }

      const invalidIds = skillIds.filter(
        (id) => !availableSkillIds.includes(id),
      );
      if (invalidIds.length > 0) {
        return {
          status: "error",
          error: {
            code: "INVALID_SKILL_IDS",
            message: `Invalid skill IDs: ${invalidIds.join(", ")}. Available skills: ${availableSkillIds.join(", ")}`,
          },
        };
      }

      const result = await subAgentService.spawn({
        skillIds,
        goal,
        systemPrompt,
        outputStrategy,
      });

      return {
        status: "done",
        output: result.output,
        outputPath: result.outputPath,
      };
    },
  });
}
