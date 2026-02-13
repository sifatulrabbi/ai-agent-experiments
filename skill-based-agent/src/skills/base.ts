import { type Tool } from "ai";

export type SkillId = string;

export interface SkillMetadata {
  id: SkillId;
  version: string;
  description: string;
  useWhen: string;
  toolNames: string[];
  dependencies: SkillId[];
}

export interface SkillDefinition<D> {
  id: SkillId;
  metadata: SkillMetadata;
  frontmatter: string;
  instructions: string;
  tools: { [k: string]: Tool };
  dependencies: D;
}

export function renderSkillFrontmatter(metadata: SkillMetadata): string {
  const tools = metadata.toolNames.join(", ");
  const deps = metadata.dependencies.join(", ");

  return `---
skill: ${metadata.id}
version: ${metadata.version}
description: ${metadata.description}
use-when: ${metadata.useWhen}
tools: [${tools}]
dependencies: [${deps}]
---`;
}
