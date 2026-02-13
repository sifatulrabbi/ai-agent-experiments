import { openrouter } from "@openrouter/ai-sdk-provider";
import { resolve } from "node:path";
import { createOrchestration } from "./orchestration";
import { createFS } from "./services/fs";
import { createSubAgent } from "./services/sub-agent";
import { SkillDefinition } from "./skills/base";
import { createDocxSkill } from "./skills/docx";
import { createPptxSkill } from "./skills/pptx";
import { createSubAgentSkill } from "./skills/sub-agent";
import { createWorkspaceSkill } from "./skills/workspace";
import { createXlsxSkill } from "./skills/xlsx";
import { consoleLogger } from "./logger";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";
import {
  createStubDocxService,
  createStubPptxService,
  createStubXlsxService,
} from "./services/stubs";

export async function buildAgent() {
  const workspaceFsPath = resolve(import.meta.dir, "../../../tmp/project");
  const fs = await createFS(workspaceFsPath);

  const skills: SkillDefinition<unknown>[] = [
    createWorkspaceSkill({ fsClient: fs }),
    createDocxSkill({ fsClient: fs, docxClient: createStubDocxService() }),
    createPptxSkill({ fsClient: fs, pptxClient: createStubPptxService() }),
    createXlsxSkill({ fsClient: fs, xlsxClient: createStubXlsxService() }),
  ];

  const subAgentSkill = createSubAgentSkill({
    subAgentService: await createSubAgent(skills),
    availableSkillIds: skills.map((s) => s.id),
  });

  skills.push(subAgentSkill);

  return createOrchestration(
    {
      model: openrouter("stepfun/step-3.5-flash:free", {
        reasoning: {
          enabled: true,
          effort: "medium",
        },
      }),
      skillsRegistry: skills,
      instructionsBuilder: buildRootAgentPrompt,
    },
    consoleLogger,
  );
}
