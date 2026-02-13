import { openrouter } from "@openrouter/ai-sdk-provider";
import { type UIMessageChunk } from "ai";

import { createOrchestration } from "../../orchestration";
import {
  createStubFs,
  createStubDocxService,
  createStubPptxService,
  createStubXlsxService,
} from "../../services/stubs";
import { createSubAgent } from "../../services/sub-agent";
import { createWorkspaceSkill } from "../../skills/workspace";
import { createDocxSkill } from "../../skills/docx";
import { createPptxSkill } from "../../skills/pptx";
import { createXlsxSkill } from "../../skills/xlsx";
import { consoleLogger } from "../../logger";
import { buildRootAgentPrompt } from "../../prompts/root-agent-prompt";
import { createSubAgentSkill } from "../../skills/sub-agent";
import { type SkillDefinition } from "../../skills/base";

function formatChunk(chunk: UIMessageChunk): string {
  switch (chunk.type) {
    case "start":
      return `\n[ui:start] messageId=${chunk.messageId ?? "n/a"}\n`;
    case "start-step":
      return `\n[ui:step:start]\n`;
    case "reasoning-start":
      return `\n[reasoning:start] id=${chunk.id}\n`;
    case "reasoning-delta":
      return `${chunk.delta}`;
    case "reasoning-end":
      return `\n[reasoning:end] id=${chunk.id}\n`;
    case "tool-input-start":
      return `\n[tool:input:start] tool=${chunk.toolName} callId=${chunk.toolCallId}\n`;
    case "tool-input-delta":
      return `${chunk.inputTextDelta}`;
    case "tool-input-available":
      //  input=${JSON.stringify(chunk.input)}
      return `\n[tool:call] tool=${chunk.toolName} callId=${chunk.toolCallId}\n`;
    case "tool-output-available":
      return `\n[tool:response] callId=${chunk.toolCallId} output=${JSON.stringify(chunk.output)}\n`;
    case "tool-output-error":
      return `\n[tool:error] callId=${chunk.toolCallId} error=${chunk.errorText}\n`;
    case "tool-output-denied":
      return `\n[tool:denied] callId=${chunk.toolCallId}\n`;
    case "text-start":
      return `\n[text:start] id=${chunk.id}\n`;
    case "text-delta":
      return `${chunk.delta}`;
    case "text-end":
      return `\n[text:end] id=${chunk.id}\n`;
    case "finish-step":
      return `\n[ui:step:finish]\n`;
    case "finish":
      return `\n[ui:finish] reason=${chunk.finishReason ?? "unknown"}\n`;
    case "abort":
      return `\n[ui:abort] reason=${chunk.reason ?? "unknown"}\n`;
    case "error":
      return `\n[ui:error] ${chunk.errorText}\n`;
    default:
      return `\n[ui:${chunk.type}] ${JSON.stringify(chunk)}\n`;
  }
}

async function main(): Promise<void> {
  const fs = createStubFs({
    "/readme.md": "# Hello\nWelcome to the workspace.",
    "/docs/plan.md": "## Plan\n1. Build the agent\n2. Test it\n3. Ship it",
    "/docs/notes.md": "Some notes here.",
  });

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

  const agent = await createOrchestration(
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

  const stream = await agent.stream({
    messages: [
      { role: "user", content: "Tell me what is my workspace is about?" },
    ],
  });

  console.log("=== UIMessage Stream Events ===");
  for await (const chunk of stream.toUIMessageStream()) {
    process.stdout.write(formatChunk(chunk));
  }
}

void main();
