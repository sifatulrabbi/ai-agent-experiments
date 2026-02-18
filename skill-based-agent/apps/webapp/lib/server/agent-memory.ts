import { createFsMemory, type FsMemory } from "@protean/agent-memory";
import { createLocalFs } from "@protean/vfs";

let memoryPromise: FsMemory | null = null;

export async function getAgentMemory(): Promise<FsMemory> {
  if (!memoryPromise) {
    const fs = await createLocalFs(process.cwd() + "/.data");
    memoryPromise = createFsMemory({ fs });
  }

  return memoryPromise;
}
