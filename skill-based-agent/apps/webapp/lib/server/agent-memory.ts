import { createFsMemory, type AgentMemory } from "@protean/agent-memory";
import { createLocalFs } from "@protean/vfs";

let memoryPromise: AgentMemory | null = null;

export async function getAgentMemory(): Promise<AgentMemory> {
  if (!memoryPromise) {
    const fs = await createLocalFs(process.cwd() + "/.data");
    memoryPromise = createFsMemory({ fs });
  }

  return memoryPromise;
}
