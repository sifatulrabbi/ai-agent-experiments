import { describe, expect, test } from "bun:test";
import { tool } from "ai";
import z from "zod";

import { DependencyResolutionError, UnknownSkillError } from "../../errors";
import {
  type SkillDefinition,
  renderSkillFrontmatter,
  type SkillMetadata,
} from "../../skills/base";
import { resolveSkillLoadOrder } from "../../skills/resolve-skill-dependencies";

function createSkill(
  id: string,
  dependencies: string[],
): SkillDefinition<unknown> {
  const metadata: SkillMetadata = {
    id,
    version: "1.0.0",
    description: `${id} description`,
    useWhen: `${id} use when`,
    toolNames: [`${id}-tool`],
    dependencies,
  };

  const tools = {
    [`${id}-tool`]: tool({
      description: `${id} tool`,
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
    }),
  };

  return {
    id,
    metadata,
    frontmatter: renderSkillFrontmatter(metadata),
    instructions: `${id} instructions`,
    tools,
    dependencies: {},
  };
}

describe("resolveSkillLoadOrder", () => {
  test("resolves transitive dependencies in topological order", () => {
    const skills = new Map<string, SkillDefinition<unknown>>([
      ["workspace-skill", createSkill("workspace-skill", [])],
      ["docx-skill", createSkill("docx-skill", ["workspace-skill"])],
      ["sub-agent-skill", createSkill("sub-agent-skill", ["workspace-skill"])],
    ]);

    const result = resolveSkillLoadOrder(skills, ["docx-skill"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order).toEqual(["workspace-skill", "docx-skill"]);
    }
  });

  test("returns unknown skill error", () => {
    const skills = new Map<string, SkillDefinition<unknown>>();
    const result = resolveSkillLoadOrder(skills, ["missing-skill"]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UnknownSkillError);
    }
  });

  test("returns cycle error", () => {
    const skills = new Map<string, SkillDefinition<unknown>>([
      ["a", createSkill("a", ["b"])],
      ["b", createSkill("b", ["a"])],
    ]);

    const result = resolveSkillLoadOrder(skills, ["a"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(DependencyResolutionError);
    }
  });
});
