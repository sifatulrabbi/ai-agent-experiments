# LLM Code Execution Agent

An intelligent LLM agent that executes TypeScript code and interacts with external capabilities. Built with LangChain, LangGraph, and OpenAI's GPT models.

## Philosophy

This project explores **code-based capabilities** for LLMs - giving AI agents the ability to write and execute code to accomplish tasks, rather than calling pre-defined tool functions directly.

### Why Code Execution?

Traditional tool-calling requires defining rigid function interfaces upfront. Code execution offers:

- **Flexibility**: Agents compose existing tools in novel ways
- **Expressiveness**: Complex logic without adding new tools
- **Natural reasoning**: LLMs are trained on code and excel at writing it
- **Reduced API surface**: Fewer predefined functions to maintain

As described in Anthropic's [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) blog post, code execution enables agents to handle multi-step tasks, data transformations, and creative problem-solving that would otherwise require numerous specialized tools.

This project implements that philosophy: the agent discovers available capabilities through TypeScript declarations, then writes and executes code that imports and uses those capabilities as needed.

## Quick Start

```bash
# Install dependencies
bun install

# Run the agent
bun run dev
```

## Features

- Interactive CLI with streaming responses
- Dynamic TypeScript code execution using Bun
- Extensible capabilities system with automatic discovery
- Type-safe tool definitions

## Architecture

### Core Components

**Agent Graph** (`src/agent.ts`) - LangGraph state machine that routes between LLM calls and tool execution

**Interactive CLI** (`src/index.ts`) - Readline interface with conversation history

**System Prompt Builder** (`src/buildSystemPrompt.ts`) - Dynamically constructs prompts with available capabilities

**LLM Tools** (`src/llmTools/`):

- `executeCodeHandler` - Runs TypeScript in temporary sandbox
- `discoverCapabilities` - Finds available tool declarations
- `readCapabilityDeclaration` - Reads API documentation

### Capabilities System

Capabilities use a declarative pattern:

```
capabilities/
├── declarations/       # TypeScript .d.ts files
└── *.ts               # Implementations
```

**Declaration files** define types and JSDoc. **Implementation files** contain logic. The agent discovers declarations, reads them for context, then writes code that imports capabilities using the `@tools/*` path alias.

Example:

```typescript
import { getEmails, sendEmail } from "@tools/emailTools";
const emails = await getEmails();
```

## Adding New Capabilities

1. Create `capabilities/declarations/yourTool.d.ts` with types and JSDoc
2. Implement `capabilities/yourTool.ts` with actual functions
3. Agent automatically discovers and uses it

## Configuration

Set your OpenAI API key in `.env`:

```env
OPENAI_API_KEY=your_api_key_here
```

LLM model configured in `src/agent.ts:25-31`.

## Project Structure

```
src/
├── index.ts                   # CLI entry point
├── agent.ts                   # Agent definition
├── buildSystemPrompt.ts       # Prompt builder
└── llmTools/                  # Built-in tools

capabilities/
├── declarations/              # Type definitions
└── *.ts                       # Implementations
```

## Technologies

- [Bun](https://bun.com) - JavaScript runtime
- [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/) - LLM framework
- OpenAI GPT - AI model
- TypeScript
