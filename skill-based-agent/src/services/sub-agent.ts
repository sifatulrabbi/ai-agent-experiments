export type OutputStrategy = "string" | "workspace-file" | "tmp-file";

export interface SubAgentConfig {
  skillIds: string[];
  goal: string;
  systemPrompt?: string;
  outputStrategy: OutputStrategy;
}

export interface SubAgentResult {
  output: string;
  outputPath?: string;
}

export interface SubAgentService {
  spawn(config: SubAgentConfig): Promise<SubAgentResult>;
}
