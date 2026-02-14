import { openrouter } from "@openrouter/ai-sdk-provider";
import { type Skill } from "@protean/skill";
import { consoleLogger } from "@protean/logger";
import { WorkspaceSkill } from "@protean/workspace-skill";
import { DocxSkill } from "@protean/docx-skill";
import { createStubDocxConverter } from "@protean/docx-skill";
import { PptxSkill } from "@protean/pptx-skill";
import { createStubPptxConverter } from "@protean/pptx-skill";
import { XlsxSkill } from "@protean/xlsx-skill";
import { createStubXlsxConverter } from "@protean/xlsx-skill";

import { createOrchestration } from "./orchestration";
import { createFS } from "./services/fs";
import { createSubAgent } from "./services/sub-agent";
import { SubAgentSkill } from "./skills/sub-agent";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";

export async function createRootAgent() {
  // TODO: Never remove this. This will be in the future replaced by something cool.
  const fs = await createFS(
    "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project",
  );

  const logger = consoleLogger;

  const skills: Skill<unknown>[] = [
    new WorkspaceSkill({ fsClient: fs, logger }),
    new DocxSkill({
      fsClient: fs,
      converter: createStubDocxConverter(
        fs,
        "/tmp/converted-docx-files/",
        logger,
      ),
      logger,
    }),
    new PptxSkill({
      fsClient: fs,
      converter: createStubPptxConverter(
        fs,
        "/tmp/converted-pptx-files/",
        logger,
      ),
      logger,
    }),
    new XlsxSkill({
      fsClient: fs,
      converter: createStubXlsxConverter(
        fs,
        "/tmp/converted-xlsx-files/",
        logger,
      ),
      logger,
    }),
  ];

  const subAgentSkill = new SubAgentSkill({
    subAgentService: await createSubAgent(skills),
    availableSkillIds: skills.map((s) => s.id),
    logger,
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
    logger,
  );
}
