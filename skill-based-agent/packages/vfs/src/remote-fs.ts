import { normalize } from "path";
import { type Logger } from "@protean/logger";
import { type FS } from "./interfaces";

interface RemoteFsConfig {
  baseUrl: string;
  serviceToken: string;
  userId: string;
  logger?: Logger;
}

export function createRemoteFs(config: RemoteFsConfig): FS {
  const { baseUrl, serviceToken, userId, logger } = config;
  const base = baseUrl.replace(/\/+$/, "");

  function headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${serviceToken}`,
      "X-User-Id": userId,
    };
  }

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers(), ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`VFS request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as {
      ok: boolean;
      error?: { message: string };
      data?: T;
    };
    if (!body.ok) {
      throw new Error(body.error?.message ?? "Unknown VFS error");
    }
    return body.data as T;
  }

  function normalizePath(filePath: string): string {
    return normalize(filePath).replace(/^\/+/, "").replace(/\\/g, "/");
  }

  return {
    stat: async (filePath) => {
      logger?.debug("RemoteFS.stat", { filePath });
      const q = encodeURIComponent(filePath);
      return fetchJson(`${base}/api/v1/files/stat?path=${q}`);
    },

    readdir: async (dirPath) => {
      logger?.debug("RemoteFS.readdir", { dirPath });
      const q = encodeURIComponent(dirPath);
      const data = await fetchJson<{
        entries: Array<{ name: string; isDirectory: boolean }>;
      }>(`${base}/api/v1/files/readdir?path=${q}`);
      return data.entries;
    },

    readFile: async (filePath) => {
      logger?.debug("RemoteFS.readFile", { filePath });
      const q = encodeURIComponent(filePath);
      const data = await fetchJson<{ content: string }>(
        `${base}/api/v1/files/read?path=${q}`,
      );
      return data.content;
    },

    readFileBuffer: async (filePath) => {
      logger?.debug("RemoteFS.readFileBuffer", { filePath });
      const q = encodeURIComponent(filePath);
      const res = await fetch(`${base}/api/v1/files/read-binary?path=${q}`, {
        headers: headers(),
      });
      if (!res.ok) {
        throw new Error(`VFS request failed: ${res.status} ${res.statusText}`);
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    },

    mkdir: async (dirPath) => {
      logger?.debug("RemoteFS.mkdir", { dirPath });
      await fetchJson(`${base}/api/v1/files/mkdir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      });
    },

    writeFile: async (filePath, content) => {
      logger?.debug("RemoteFS.writeFile", { filePath, bytes: content.length });
      await fetchJson(`${base}/api/v1/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
    },

    writeFileBuffer: async (filePath, content) => {
      logger?.debug("RemoteFS.writeFileBuffer", {
        filePath,
        bytes: content.length,
      });
      const formData = new FormData();
      formData.append("path", filePath);
      const blobPayload = new Uint8Array(content.length);
      blobPayload.set(content);
      formData.append("file", new Blob([blobPayload]));
      const res = await fetch(`${base}/api/v1/files/write-binary`, {
        method: "POST",
        headers: headers(),
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`VFS request failed: ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!body.ok) {
        throw new Error(body.error?.message ?? "Unknown VFS error");
      }
    },

    remove: async (fullPath) => {
      logger?.debug("RemoteFS.remove", { fullPath });
      const q = encodeURIComponent(fullPath);
      await fetchJson(`${base}/api/v1/files/remove?path=${q}`, {
        method: "DELETE",
      });
    },

    resolvePath: (filePath) => {
      return normalizePath(filePath);
    },
  };
}
