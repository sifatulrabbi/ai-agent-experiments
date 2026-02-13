import { type OutputStrategy } from "../services/sub-agent";

/**
 * Build a focused system prompt for a sub-agent.
 * Sub-agents get all their tools pre-loaded — no Skill tool needed.
 */
export function buildSubAgentSystemPrompt(
  outputStrategy: OutputStrategy,
  customSystemPrompt?: string,
) {
  let outputGuidance: string;
  switch (outputStrategy) {
    case "string":
      outputGuidance =
        "Return your result as a direct text response. Be concise and focused.";
      break;
    case "workspace-file":
      outputGuidance =
        "Write your final result to a file in the workspace using WriteFile. Choose a clear, descriptive file path. State the output file path in your response.";
      break;
    case "tmp-file":
      outputGuidance =
        "Write your final result to a file under /tmp/ using WriteFile. State the output file path in your response.";
      break;
  }

  return (cfg: {
    skillFrontmatters: { id: string; frontmatter: string }[];
  }) => {
    const skillBlock = cfg.skillFrontmatters
      .map((s) => `<skill id="${s.id}">\n${s.frontmatter}\n</skill>`)
      .join("\n\n");

    return `You are a focused sub-agent. You have a single task to accomplish. Complete it using the tools available to you, then respond with your result.

# Output Strategy
${outputGuidance}
${
  customSystemPrompt
    ? `
# Important Instructions
${customSystemPrompt}`
    : ""
}

# Capability Instructions
You must use the following skills to achieve the given goal.
${skillBlock}`;
  };
}
