import { openai } from "@ai-sdk/openai";
import { type LanguageModel, type ModelMessage } from "ai";

import { type Logger, noopLogger } from "./logger";
import { AgentOrchestrator } from "./bak/orchestrator";
import { createSubAgentOrchestrator } from "./bak/sub-agent-orchestrator";
import { type DocxService } from "./services/docx";
import { type FS } from "./services/fs";
import { type PptxService } from "./services/pptx";
import { type XlsxService } from "./services/xlsx";
import {
  createStubDocxService,
  createStubFs,
  createStubPptxService,
  createStubXlsxService,
} from "./services/stubs";
import { createDocxSkill } from "./skills/docx";
import { createPptxSkill } from "./skills/pptx";
import { createSubAgentSkill } from "./skills/sub-agent";
import { createWorkspaceSkill } from "./skills/workspace";
import { createXlsxSkill } from "./skills/xlsx";

interface AgentServices {
  fsClient: FS;
  docxClient: DocxService;
  pptxClient: PptxService;
  xlsxClient: XlsxService;
}

type ModelFactory = () => LanguageModel;

export interface BuildAgentAppConfig {
  services?: AgentServices;
  model?: LanguageModel;
  modelFactory?: ModelFactory;
  logger?: Logger;
  rootMaxSteps?: number;
  subAgentMaxSteps?: number;
}

function createDefaultServices(): AgentServices {
  return {
    fsClient: createStubFs(),
    docxClient: createStubDocxService(),
    pptxClient: createStubPptxService(),
    xlsxClient: createStubXlsxService(),
  };
}

function resolveModel(config: BuildAgentAppConfig): LanguageModel {
  if (config.model) {
    return config.model;
  }

  if (config.modelFactory) {
    return config.modelFactory();
  }

  return openai("gpt-5.2");
}

export function buildAgentApp(config: BuildAgentAppConfig = {}) {
  const services = config.services ?? createDefaultServices();
  const logger = config.logger ?? noopLogger;
  const model = resolveModel(config);

  const baseSkills = [
    createWorkspaceSkill({ fsClient: services.fsClient }),
    createDocxSkill({
      fsClient: services.fsClient,
      docxClient: services.docxClient,
    }),
    createPptxSkill({
      fsClient: services.fsClient,
      pptxClient: services.pptxClient,
    }),
    createXlsxSkill({
      fsClient: services.fsClient,
      xlsxClient: services.xlsxClient,
    }),
  ];

  const subAgentService = createSubAgentOrchestrator({
    skills: baseSkills,
    model,
    logger,
    maxSteps: config.subAgentMaxSteps,
  });

  const subAgentSkill = createSubAgentSkill({
    subAgentService,
    availableSkillIds: baseSkills.map((skill) => skill.id),
  });

  const orchestrator = new AgentOrchestrator({
    skills: [...baseSkills, subAgentSkill],
    model,
    logger,
    maxSteps: config.rootMaxSteps,
  });

  return {
    orchestrator,
    services,
    skills: [...baseSkills, subAgentSkill],
    run: (messages: ModelMessage[]) => orchestrator.run({ messages }),
  };
}
