import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UIMessage } from "ai";
import type { ReasoningBudget } from "@/components/chat/model-catalog";

export interface ThreadModelSelection {
  providerId: string;
  modelId: string;
  reasoningBudget: ReasoningBudget;
}

export interface ChatThread {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: UIMessage[];
  modelSelection?: ThreadModelSelection;
}

export interface CreateThreadParams {
  userId: string;
  title?: string;
  modelSelection?: ThreadModelSelection;
  messages?: UIMessage[];
}

export interface SaveMessagesParams {
  userId: string;
  threadId: string;
  messages: UIMessage[];
}

export interface UpdateThreadSettingsParams {
  userId: string;
  threadId: string;
  modelSelection: ThreadModelSelection;
}

export interface ChatRepository {
  createThread(params: CreateThreadParams): Promise<ChatThread>;
  listThreads(userId: string): Promise<ChatThread[]>;
  getThread(userId: string, threadId: string): Promise<ChatThread | null>;
  saveMessages(params: SaveMessagesParams): Promise<ChatThread | null>;
  updateThreadSettings(
    params: UpdateThreadSettingsParams,
  ): Promise<ChatThread | null>;
  deleteThread(userId: string, threadId: string): Promise<boolean>;
}

function normalizeMessageIds(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    const messageId = typeof message.id === "string" ? message.id.trim() : "";
    if (messageId.length > 0) {
      return message;
    }

    return {
      ...message,
      id: randomUUID(),
    };
  });
}

class LocalFileChatRepository implements ChatRepository {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async createThread({
    messages,
    userId,
    title,
    modelSelection,
  }: CreateThreadParams): Promise<ChatThread> {
    const now = new Date().toISOString();

    const thread: ChatThread = {
      createdAt: now,
      id: randomUUID(),
      messages: normalizeMessageIds(messages ?? []),
      modelSelection,
      title: title?.trim() || "New chat",
      updatedAt: now,
      userId,
    };

    const threads = await this.readThreads();
    threads.push(thread);
    await this.writeThreads(threads);

    return thread;
  }

  async listThreads(userId: string): Promise<ChatThread[]> {
    const threads = await this.readThreads();

    return threads
      .filter((thread) => thread.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getThread(
    userId: string,
    threadId: string,
  ): Promise<ChatThread | null> {
    const threads = await this.readThreads();
    const thread = threads.find((item) => item.id === threadId);

    if (!thread || thread.userId !== userId) {
      return null;
    }

    return thread;
  }

  async saveMessages({
    userId,
    threadId,
    messages,
  }: SaveMessagesParams): Promise<ChatThread | null> {
    const threads = await this.readThreads();
    const threadIndex = threads.findIndex((item) => item.id === threadId);

    if (threadIndex < 0) {
      return null;
    }

    const thread = threads[threadIndex];

    if (!thread || thread.userId !== userId) {
      return null;
    }

    const normalizedMessages = normalizeMessageIds(messages);
    const firstUserMessage = normalizedMessages.find(
      (message) => message.role === "user",
    );
    let firstUserText: string | undefined;

    if (firstUserMessage) {
      for (const part of firstUserMessage.parts) {
        if (part.type === "text" && part.text.trim()) {
          firstUserText = part.text;
          break;
        }
      }
    }

    const updatedThread: ChatThread = {
      ...thread,
      messages: normalizedMessages,
      updatedAt: new Date().toISOString(),
      ...(thread.title === "New chat" && firstUserText
        ? { title: firstUserText.slice(0, 60) }
        : {}),
    };

    threads[threadIndex] = updatedThread;
    await this.writeThreads(threads);

    return updatedThread;
  }

  async updateThreadSettings({
    userId,
    threadId,
    modelSelection,
  }: UpdateThreadSettingsParams): Promise<ChatThread | null> {
    const threads = await this.readThreads();
    const threadIndex = threads.findIndex((item) => item.id === threadId);

    if (threadIndex < 0) {
      return null;
    }

    const thread = threads[threadIndex];

    if (!thread || thread.userId !== userId) {
      return null;
    }

    const updatedThread: ChatThread = {
      ...thread,
      modelSelection,
      updatedAt: new Date().toISOString(),
    };

    threads[threadIndex] = updatedThread;
    await this.writeThreads(threads);

    return updatedThread;
  }

  async deleteThread(userId: string, threadId: string): Promise<boolean> {
    const threads = await this.readThreads();
    const target = threads.find(
      (thread) => thread.id === threadId && thread.userId === userId,
    );

    if (!target) {
      return false;
    }

    const nextThreads = threads.filter((thread) => thread.id !== threadId);
    await this.writeThreads(nextThreads);
    return true;
  }

  private async readThreads(): Promise<ChatThread[]> {
    try {
      const file = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(file) as ChatThread[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeThreads(threads: ChatThread[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(threads, null, 2), "utf8");
  }
}

class ChatRepositoryFactory {
  private static repository: ChatRepository;

  static getRepository(): ChatRepository {
    if (!ChatRepositoryFactory.repository) {
      ChatRepositoryFactory.repository = new LocalFileChatRepository(
        path.join(process.cwd(), ".data", "chat-threads.json"),
      );
    }

    return ChatRepositoryFactory.repository;
  }
}

export const chatRepository: ChatRepository =
  ChatRepositoryFactory.getRepository();
