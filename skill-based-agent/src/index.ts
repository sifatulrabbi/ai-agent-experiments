import { openrouter } from "@openrouter/ai-sdk-provider";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { type ModelMessage } from "ai";

import { createAgent } from "./orchestrator";
import {
  createStubDocxService,
  createStubPptxService,
  createStubXlsxService,
} from "./services/stubs";
import { createFS } from "./services/fs";
import { createSubAgent } from "./services/sub-agent";
import { createWorkspaceSkill } from "./skills/workspace";
import { createDocxSkill } from "./skills/docx";
import { createPptxSkill } from "./skills/pptx";
import { createXlsxSkill } from "./skills/xlsx";
import { consoleLogger } from "./logger";
import { buildRootAgentPrompt } from "./prompts/root-agent-prompt";
import { createSubAgentSkill } from "./skills/sub-agent";
import { formatChunk } from "./utils";
import { type SkillDefinition } from "./skills/base";

async function main(): Promise<void> {
  const fs = await createFS(
    "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/tmp/project",
  );

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

  const agent = await createAgent(
    {
      model: openrouter("moonshotai/kimi-k2.5", {
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

  const rl = createInterface({ input, output });
  const history: ModelMessage[] = [];

  console.log('Interactive mode. Type "exit" to quit.\n');

  try {
    while (true) {
      const userText = (await rl.question("> ")).trim();
      if (!userText) {
        continue;
      }
      if (
        userText.toLowerCase() === "exit" ||
        userText.toLowerCase() === "quit"
      ) {
        break;
      }

      history.push({ role: "user", content: userText });

      const stream = await agent.stream({
        messages: history,
      });

      console.log("=== UIMessage Stream Events ===");
      for await (const chunk of stream.toUIMessageStream()) {
        process.stdout.write(formatChunk(chunk));
      }
      console.log("");

      const response = await stream.response;
      history.push(...response.messages);
    }
  } finally {
    rl.close();
  }
}

void main();
