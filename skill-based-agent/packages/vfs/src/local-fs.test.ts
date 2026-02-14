import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createLocalFs, type FS } from "./index";

let root: string;
let fs: FS;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "local-fs-test-"));
  fs = await createLocalFs(root);
});

afterAll(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

describe("createLocalFs", () => {
  describe("writeFile", () => {
    test("creates a file and writes content", async () => {
      await fs.writeFile("hello.txt", "hello world");

      const content = await readFile(join(root, "hello.txt"), "utf8");
      expect(content).toBe("hello world");
    });

    test("creates intermediate directories", async () => {
      await fs.writeFile("a/b/c.txt", "nested");

      const content = await readFile(join(root, "a/b/c.txt"), "utf8");
      expect(content).toBe("nested");
    });

    test("overwrites existing file", async () => {
      await fs.writeFile("overwrite.txt", "first");
      await fs.writeFile("overwrite.txt", "second");

      const content = await readFile(join(root, "overwrite.txt"), "utf8");
      expect(content).toBe("second");
    });
  });

  describe("readFile", () => {
    test("reads file content", async () => {
      await writeFile(join(root, "read-me.txt"), "file content", "utf8");

      const content = await fs.readFile("read-me.txt");
      expect(content).toBe("file content");
    });

    test("throws for non-existent file", async () => {
      expect(fs.readFile("does-not-exist.txt")).rejects.toThrow();
    });
  });

  describe("stat", () => {
    test("returns metadata for a file", async () => {
      await writeFile(join(root, "stat-me.txt"), "some content", "utf8");

      const result = await fs.stat("stat-me.txt");
      expect(result.isDirectory).toBe(false);
      expect(result.size).toBeGreaterThan(0);
      expect(result.modified).toBeTruthy();
      expect(result.created).toBeTruthy();
    });

    test("throws for non-existent path", async () => {
      expect(fs.stat("nope.txt")).rejects.toThrow();
    });
  });

  describe("readdir", () => {
    test("lists directory entries", async () => {
      await writeFile(join(root, "file1.txt"), "a", "utf8");
      await mkdir(join(root, "subdir"));

      const entries = await fs.readdir(".");
      const names = entries.map((e) => e.name).sort();

      expect(names).toContain("file1.txt");
      expect(names).toContain("subdir");

      const dirEntry = entries.find((e) => e.name === "subdir");
      expect(dirEntry?.isDirectory).toBe(true);

      const fileEntry = entries.find((e) => e.name === "file1.txt");
      expect(fileEntry?.isDirectory).toBe(false);
    });

    test("throws for non-existent directory", async () => {
      expect(fs.readdir("no-such-dir")).rejects.toThrow();
    });
  });

  describe("mkdir", () => {
    test("creates a directory", async () => {
      await fs.mkdir("new-dir");

      const entries = await fs.readdir(".");
      expect(entries.map((e) => e.name)).toContain("new-dir");
    });

    test("creates nested directories", async () => {
      await fs.mkdir("x/y/z");

      const entries = await fs.readdir("x/y");
      expect(entries.map((e) => e.name)).toContain("z");
    });
  });

  describe("remove", () => {
    test("removes a file", async () => {
      await writeFile(join(root, "to-delete.txt"), "bye", "utf8");
      await fs.remove("to-delete.txt");

      expect(fs.readFile("to-delete.txt")).rejects.toThrow();
    });

    test("removes a directory recursively", async () => {
      await fs.writeFile("to-delete/sub/file.txt", "bye");
      await fs.remove("to-delete");

      expect(fs.readdir("to-delete")).rejects.toThrow();
    });

    test("does not throw for non-existent file", async () => {
      await fs.remove("already-gone.txt");
    });
  });

  describe("path traversal prevention", () => {
    test("rejects paths that escape the root", async () => {
      expect(fs.readFile("../../etc/passwd")).rejects.toThrow(
        /escapes workspace root/,
      );
    });

    test("rejects paths with .. that escape the root", async () => {
      expect(fs.writeFile("../outside.txt", "bad")).rejects.toThrow(
        /escapes workspace root/,
      );
    });

    test("allows absolute-looking paths that resolve within root", async () => {
      await fs.writeFile("/hello.txt", "hi");
      const content = await fs.readFile("/hello.txt");
      expect(content).toBe("hi");
    });
  });
});
