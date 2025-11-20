# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

description: Use Bun instead of Node.js, npm, pnpm, or vite.
alwaysApply: true

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Project Overview

This is an LLM agent project that executes TypeScript code with access to external capabilities (tools). The agent is built using LangChain and LangGraph with OpenAI's GPT models.

## Development Commands

- **Run the agent**: `bun run dev` or `bun ./src/index.ts`
- **Install dependencies**: `bun install`

## Architecture

### Core Components

1. **Agent (`src/agent.ts`)**: LangGraph-based agent with a simple graph flow:
   - `llmCallNode`: Invokes the LLM with system prompt and binds available tools
   - `shouldContinue`: Routes to either tool execution or END based on tool calls
   - `toolsNode`: Executes tool calls using LangChain's ToolNode

2. **Interactive CLI (`src/index.ts`)**:
   - Readline-based chat interface that streams agent responses
   - Maintains conversation history across turns
   - Displays both reasoning and text content blocks from LLM responses

3. **System Prompt Builder (`src/buildSystemPrompt.ts`)**:
   - Dynamically builds system prompts that include available capabilities
   - Provides instructions on how to use the `execute_code` tool
   - Explains capability discovery and declaration reading

4. **LLM Tools (`src/llmTools/`)**:
   - `executeCodeHandler.ts`: Executes TypeScript code snippets in temporary files using Bun
   - `discoverCapabilities.ts`: Finds all `.d.ts` files in `capabilities/declarations/`
   - `readCapabilityDeclaration.ts`: Reads declaration files for detailed API information

### Capabilities System

The project uses a capabilities pattern where:

1. **Declaration files** (`capabilities/declarations/*.d.ts`) define TypeScript type definitions and JSDoc for external tools
2. **Implementation files** (`capabilities/*.ts`) contain actual implementations that match the declarations
3. **Path mapping** in `tsconfig.json`: `@tools/*` maps to `./capabilities/*`
4. **Runtime execution**: Code executed via `execute_code` tool can import capabilities using `@tools/` namespace

Example:

```typescript
import { getEmails, sendEmail } from "@tools/emailTools";
const emails = await getEmails();
```

### Key Files

- `src/agent.ts:25-31` - LLM model configuration (GPT-5.1 with reasoning)
- `src/agent.ts:39-59` - Conditional routing logic for tool execution
- `src/llmTools/executeCodeHandler.ts:11-46` - Code execution in `.tmp/` directory
- `capabilities/declarations/` - Tool type declarations for LLM awareness
- `capabilities/` - Actual tool implementations

### Adding New Capabilities

1. Create a TypeScript declaration file in `capabilities/declarations/<tool>.d.ts`
2. Implement the actual functions in `capabilities/<tool>.ts`
3. The agent will automatically discover the declaration file via `discoverCapabilities()`
4. LLM can read the declaration and import/execute using the `execute_code` tool
