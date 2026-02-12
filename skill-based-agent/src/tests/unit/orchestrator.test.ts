import { describe, expect, test } from "bun:test";
import { tool } from "ai";
import z from "zod";

import { ToolCollisionError } from "../../errors";
import { AgentOrchestrator } from "../../orchestrator";
import {
  type SkillDefinition,
  type SkillMetadata,
  renderSkillFrontmatter,
} from "../../skills/base";

function createSkill(
  id: string,
  toolNames: string[],
  dependencies: string[] = [],
): SkillDefinition<unknown> {
  const metadata: SkillMetadata = {
    id,
    version: "1.0.0",
    description: `${id} description`,
    useWhen: `${id} use when`,
    toolNames,
    dependencies,
  };

  const tools = Object.fromEntries(
    toolNames.map((name) => [
      name,
      tool({
        description: `${name} description`,
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      }),
    ]),
  );

  return {
    id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `${id} instructions`,
    tools,
    dependencies: {},
  };
}

describe("AgentOrchestrator", () => {
  test("starts with only Skill tool active and loads dependencies", () => {
    const workspace = createSkill("workspace-skill", ["ReadDir"]);
    const docx = createSkill(
      "docx-skill",
      ["DocxToMarkdown"],
      ["workspace-skill"],
    );

    const orchestrator = new AgentOrchestrator({
      skills: [workspace, docx],
    });

    expect(orchestrator.getActiveToolNames()).toEqual(["Skill"]);

    const result = orchestrator.loadSkill("docx-skill");
    expect(result).toContain("workspace-skill instructions");
    expect(result).toContain("docx-skill instructions");

    expect(orchestrator.getLoadedSkillIds()).toEqual([
      "workspace-skill",
      "docx-skill",
    ]);
    expect(orchestrator.getActiveToolNames()).toEqual([
      "Skill",
      "ReadDir",
      "DocxToMarkdown",
    ]);
  });

  test("returns structured error messages for unknown skills", () => {
    const orchestrator = new AgentOrchestrator({
      skills: [createSkill("workspace-skill", ["ReadDir"])],
    });

    const result = orchestrator.loadSkill("missing-skill");
    expect(result).toContain("Error [UNKNOWN_SKILL]");
  });

  test("throws on tool collision", () => {
    expect(
      () =>
        new AgentOrchestrator({
          skills: [
            createSkill("a", ["SharedTool"]),
            createSkill("b", ["SharedTool"]),
          ],
        }),
    ).toThrow(ToolCollisionError);
  });
});
