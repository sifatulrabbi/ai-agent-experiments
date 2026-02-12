import { openai } from "@ai-sdk/openai";

import { AgentOrchestrator } from "../../orchestrator";
import {
  createStubFs,
  createStubDocxService,
  createStubPptxService,
  createStubXlsxService,
  createStubSubAgentService,
} from "../../services/stubs";
import { createWorkspaceSkill } from "../../skills/workspace";
import { createDocxSkill } from "../../skills/docx";
import { createPptxSkill } from "../../skills/pptx";
import { createXlsxSkill } from "../../skills/xlsx";
import { createSubAgentSkill } from "../../skills/sub-agent";

async function main(): Promise<void> {
  const fs = createStubFs({
    "/readme.md": "# Hello\nWelcome to the workspace.",
    "/docs/plan.md": "## Plan\n1. Build the agent\n2. Test it\n3. Ship it",
    "/docs/notes.md": "Some notes here.",
  });

  const skills = [
    createWorkspaceSkill({ fsClient: fs }),
    createDocxSkill({ fsClient: fs, docxClient: createStubDocxService() }),
    createPptxSkill({ fsClient: fs, pptxClient: createStubPptxService() }),
    createXlsxSkill({ fsClient: fs, xlsxClient: createStubXlsxService() }),
    createSubAgentSkill({
      subAgentService: createStubSubAgentService(),
      availableSkillIds: [
        "workspace-skill",
        "docx-skill",
        "pptx-skill",
        "xlsx-skill",
      ],
    }),
  ];

  const orchestrator = new AgentOrchestrator({ skills });
  const result = await orchestrator.run({
    model: openai("gpt-5.2"),
    userMessage: "What files are in my workspace?",
  });

  console.log("\n--- Final Response ---");
  console.log(result.text);
  console.log("\n--- Step Summary ---");
  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i];
    const toolNames = step.toolCalls.map((tc) => tc.toolName);
    console.log(
      `  Step ${i}: tools=${JSON.stringify(toolNames)} finish=${step.finishReason}`,
    );
  }
}

void main();
