// Local Storage Management

import { readFile, writeFile, mkdir, access, rm, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import type { LocalStorage, SkillSource } from "./types.js";

const DEFAULT_STORAGE_PATH = "~/.pi/agent/skill-sync.json";

export class StorageManager {
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = resolvePath(storagePath || DEFAULT_STORAGE_PATH);
  }

  async load(): Promise<LocalStorage> {
    try {
      const content = await readFile(this.storagePath, "utf-8");
      return JSON.parse(content) as LocalStorage;
    } catch (error) {
      if (isFileNotFound(error)) {
        return { sources: [] };
      }
      throw error;
    }
  }

  async save(storage: LocalStorage): Promise<void> {
    const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(storage, null, 2), "utf-8");
  }

  async addSource(source: SkillSource): Promise<void> {
    const storage = await this.load();
    const existing = storage.sources.findIndex((s) => s.name === source.name);
    if (existing >= 0) {
      storage.sources[existing] = source;
    } else {
      storage.sources.push(source);
    }
    await this.save(storage);
  }

  async removeSource(name: string): Promise<void> {
    const storage = await this.load();
    storage.sources = storage.sources.filter((s) => s.name !== name);
    await this.save(storage);
  }

  async getSource(name: string): Promise<SkillSource | undefined> {
    const storage = await this.load();
    return storage.sources.find((s) => s.name === name);
  }

  async listSources(): Promise<SkillSource[]> {
    const storage = await this.load();
    return storage.sources;
  }

  async updateSource(name: string, updates: Partial<SkillSource>): Promise<void> {
    const storage = await this.load();
    const index = storage.sources.findIndex((s) => s.name === name);
    if (index >= 0) {
      storage.sources[index] = { ...storage.sources[index], ...updates };
      await this.save(storage);
    }
  }

  async deleteLocalSkill(localPath: string): Promise<void> {
    try {
      await rm(localPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during deletion
      console.error(`Failed to delete local skill at ${localPath}:`, error);
    }
  }

  async getLocalSkillFiles(localPath: string): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];
    await this.collectFiles(localPath, localPath, files);
    return files;
  }

  private async collectFiles(
    dir: string,
    basePath: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.collectFiles(fullPath, basePath, files);
      } else {
        const relativePath = fullPath.slice(basePath.length + 1);
        const content = await readFile(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      }
    }
  }
}

function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return resolve(path);
}

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    ("code" in error ? error.code === "ENOENT" : error.message.includes("ENOENT"))
  );
}

export { resolvePath };
