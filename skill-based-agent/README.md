# Agent Orchestrator

An AI agent that **loads capabilities on demand** instead of stuffing everything into the prompt upfront.

## Why This Matters

Most agent implementations dump every tool + instruction into the system prompt at startup. That burns context window, confuses the model with irrelevant tools, and doesn't scale as you add capabilities.

**This system flips it.** The agent starts with zero tools. It reads short skill descriptions, decides what it needs, loads only that, and gets the tools + instructions injected mid-conversation. Result: leaner prompts, fewer hallucinated tool calls, and a plug-and-play skill system where adding a new capability is just adding a new file.

## How It Works

```
  "What files are in my workspace?"
         |
         v
  +--------------+
  |  Root Agent   |  sees only skill metadata (frontmatters)
  +--------------+
         |
         |  calls Skill("workspace-skill")
         v
  +--------------+
  |  prepareStep  |  activates ReadDir, WriteFile, etc.
  +--------------+
         |
         v
  +--------------+
  |  Agent uses   |  ReadDir("/") → lists files → responds
  |  the tools    |
  +--------------+
```

The agent can also **spawn sub-agents** — independent `generateText` loops that get their tools pre-loaded and run to completion:

```
  Root Agent  →  SpawnSubAgent(["workspace-skill"], "summarize /readme.md")
                        |
                        v
                  Sub-Agent runs autonomously
                  (all tools active from step 0)
                        |
                        v
                  Returns result to root agent
```

## Proof It Works

**Skill loading — agent figures out it needs workspace tools, loads them, uses them:**

```
$ bun ./src/tests/integration/agent-loading-workspace-skill.integration.ts

Step 0: toolCalls=["Skill"]    → loads workspace-skill
Step 1: toolCalls=["ReadDir"]  → lists root
Step 2: toolCalls=["ReadDir"]  → lists /docs/
Step 3: finishReason=stop      → responds with file listing
```

**Sub-agent spawning — root agent delegates a task to an independent worker:**

```
$ bun ./src/tests/integration/agent-loading-sub-agents.integration.ts

Step 0: toolCalls=["Skill"]         → loads sub-agent-skill (auto-loads workspace-skill dep)
  [sub-agent] Spawning with skills=[workspace-skill]
  [sub-agent] step: toolCalls=["GetFileStat"]
  [sub-agent] step: toolCalls=["ReadDir"]
  [sub-agent] step: finishReason=stop
Step 1: toolCalls=["SpawnSubAgent"]  → sub-agent ran and returned
Step 2: finishReason=stop            → root agent relays findings
```

## Quick Start

```bash
bun install
bun ./src/index.ts "What files are in my workspace?"  # run the agent
```

Requires `OPENAI_API_KEY` in your environment.

## Code Map

| File                            | What It Does                                                          |
| ------------------------------- | --------------------------------------------------------------------- |
| `src/orchestrator.ts`           | Core runtime — skill registry, `prepareStep`, `generateText` loop     |
| `src/skills/*.ts`               | Each skill = tools + instructions + frontmatter metadata              |
| `src/sub-agent-orchestrator.ts` | Spawns sub-agents as independent `generateText` loops                 |
| `src/services/*.ts`             | Service interfaces (FS, Docx, Pptx, Xlsx) — swap stubs for real impls |
| `src/agent.ts`                  | Wires everything together                                             |

Start with `orchestrator.ts` — that's the whole idea in ~130 lines.
