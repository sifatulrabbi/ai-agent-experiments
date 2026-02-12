import { describe, expect, test } from "bun:test";
import { type ToolExecutionOptions } from "ai";

import { type SubAgentService } from "../../services/sub-agent";
import { createSubAgentSkill } from "../../skills/sub-agent";

describe("createSubAgentSkill", () => {
  const executionOptions: ToolExecutionOptions = {
    toolCallId: "tool-call-id",
    messages: [],
  };

  test("rejects empty skillIds", async () => {
    const service: SubAgentService = {
      spawn: async () => ({ output: "ok" }),
    };

    const skill = createSubAgentSkill({
      subAgentService: service,
      availableSkillIds: ["workspace-skill"],
    });

    const execute = skill.tools.SpawnSubAgent.execute;
    if (!execute) {
      throw new Error("SpawnSubAgent execute handler is missing");
    }

    const result = await execute(
      {
        skillIds: [],
        goal: "goal",
        outputStrategy: "string",
      },
      executionOptions,
    );

    expect(result).toMatchObject({
      status: "error",
      error: { code: "INVALID_SKILL_IDS" },
    });
  });

  test("calls sub-agent service and returns normalized success payload", async () => {
    let called = false;

    const service: SubAgentService = {
      spawn: async () => {
        called = true;
        return {
          output: "done",
          outputPath: "/tmp/out.md",
        };
      },
    };

    const skill = createSubAgentSkill({
      subAgentService: service,
      availableSkillIds: ["workspace-skill"],
    });

    const execute = skill.tools.SpawnSubAgent.execute;
    if (!execute) {
      throw new Error("SpawnSubAgent execute handler is missing");
    }

    const result = await execute(
      {
        skillIds: ["workspace-skill"],
        goal: "goal",
        outputStrategy: "tmp-file",
      },
      executionOptions,
    );

    expect(called).toBe(true);
    expect(result).toMatchObject({
      status: "ok",
      output: "done",
      outputPath: "/tmp/out.md",
    });
  });
});
