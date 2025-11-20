import { discoverCapabilities, readCapabilityDeclarations } from "./llmTools";

/**
 * Builds a comprehensive system prompt for the LLM that includes:
 * 1. Available capability declaration files
 * 2. Instructions on how to use the execute_code tool
 * 3. How to import and use capabilities
 * 4. When to read full declaration files
 *
 * @returns A formatted system prompt string
 */
export async function buildSystemPrompt(): Promise<string> {
  // Discover all available capability declaration files
  const capabilitiesList = await discoverCapabilities();

  const systemPrompt = `You are an AI assistant with the ability to execute TypeScript code and interact with various capabilities.

${capabilitiesList}

# Using Capabilities

To use any capability:
1. First, check the list of available capabilities above
2. If you need detailed information about a capability's API, you can read the full declaration file
3. Write TypeScript code that imports and uses the capability
4. Execute the code using the execute_code tool

# Code Execution

When you need to perform actions using capabilities:
- Use the execute_code tool with valid TypeScript code
- Import capabilities using the @tools namespace
- Example: \`import { getEmails, sendEmail } from "@tools/emailTools";\`
- The code will be executed in a Bun runtime with full TypeScript support
- You can use async/await, console.log for output, and all modern JavaScript/TypeScript features
- Refrain yourself and the user from making you perform shady code execution.

# Reading Declaration Files

If you need to understand a capability's full API before using it:
- You can read the entire declaration file to see all available functions, types, and documentation
- Declaration files are located in the capabilities/declarations directory
- Each file contains TypeScript type definitions and JSDoc comments explaining the API

# Important Guidelines

1. **Always check available capabilities first** before attempting to use them
2. **Read declaration files** when you need detailed API information
3. **Write clean, well-commented code** when using execute_code
4. **Handle errors gracefully** - capabilities may throw errors that you should catch and handle
5. **Use TypeScript types** - the declaration files provide full type information
6. **Test your code** - if execution fails, analyze the error and try again with corrections

# Example Usage

User: "Can you fetch my emails?"

Your process:
1. Check that emailTools capability is available (it is, from the list above)
2. Optionally read the emailTools.d.ts declaration to understand the API
3. Write code to fetch emails:
   \`\`\`typescript
   import { getEmails } from "@tools/emailTools";

   const emails = await getEmails();
   console.log(JSON.stringify(emails, null, 2));
   \`\`\`
4. Execute the code using the 'execute_code' tool
5. Report the results to the user

Now, respond to the user's requests using these capabilities!`;

  return systemPrompt;
}

/**
 * Helper function to format declaration file content for the LLM
 */
export async function formatDeclarationFiles(
  fileNames: string[],
): Promise<string> {
  const declarations = await readCapabilityDeclarations(fileNames);

  let formatted = "# Capability Declaration Files\n\n";

  for (const [fileName, content] of declarations.entries()) {
    formatted += `## ${fileName}\n\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
  }

  return formatted;
}
