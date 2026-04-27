// Sync Engine

import type { SyncResult, SkillFile, SkillSource } from "./types";
import { GitHubClient, deriveSkillName } from "./github";
import { StorageManager } from "./storage";
import { IndexManager, resolveSkillPath } from "./index-manager";

export class SyncEngine {
  private client: GitHubClient;
  private storage: StorageManager;
  private index: IndexManager;

  constructor(client: GitHubClient, storage: StorageManager, index: IndexManager) {
    this.client = client;
    this.storage = storage;
    this.index = index;
  }

  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const sources = await this.storage.listSources();
    for (const source of sources) {
      const result = await this.syncSkill(source.name);
      results.push(result);
    }
    return results;
  }

  async syncSkill(name: string): Promise<SyncResult> {
    const source = await this.storage.getSource(name);
    if (!source) {
      return { success: false, name, action: "skipped", message: `Skill "${name}" not found` };
    }

    try {
      const remoteGist = await this.client.getGist(source.gistId);
      const remoteModified = new Date(remoteGist.updated_at);
      const remoteFiles = await this.getRemoteFiles(remoteGist);

      await this.downloadSkill(source.localPath, remoteFiles);

      const now = new Date().toISOString();
      await this.storage.updateSource(name, {
        lastSync: now,
        lastModified: remoteModified.toISOString(),
        needsSync: false,
      });

      await this.index.updateSkill(name, {
        lastSync: now,
        lastModified: remoteModified.toISOString(),
      });

      return { success: true, name, action: "downloaded", message: `Synced ${name}` };
    } catch (error) {
      return { success: false, name, action: "skipped", message: String(error) };
    }
  }

  async pushSkill(name: string): Promise<SyncResult> {
    const source = await this.storage.getSource(name);
    if (!source) {
      return { success: false, name, action: "skipped", message: `Skill "${name}" not found` };
    }

    try {
      const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
      const files: Record<string, { content: string }> = {};
      for (const f of localFiles) files[f.path] = { content: f.content };

      await this.client.updateGist(source.gistId, files);

      const now = new Date().toISOString();
      await this.storage.updateSource(name, {
        lastSync: now,
        lastModified: now,
        needsSync: false,
      });

      await this.index.updateSkill(name, { lastSync: now, lastModified: now });

      return { success: true, name, action: "uploaded", message: `Pushed ${name}` };
    } catch (error) {
      return { success: false, name, action: "skipped", message: String(error) };
    }
  }

  async addSkillFromGist(gistId: string, name?: string): Promise<SyncResult> {
    try {
      const gist = await this.client.getGist(gistId);
      const skillName = name || deriveSkillName(gist.description);

      if (await this.storage.getSource(skillName)) {
        return { success: false, name: skillName, action: "skipped", message: "Already exists" };
      }

      const localPath = resolveSkillPath(skillName);
      const remoteFiles = await this.getRemoteFiles(gist);
      await this.downloadSkill(localPath, remoteFiles);

      const now = new Date().toISOString();
      await this.storage.addSource({
        name: skillName,
        gistId: gist.id,
        owner: gist.owner?.login || "unknown",
        public: gist.public,
        localPath,
        lastSync: now,
        lastModified: gist.updated_at,
        needsSync: false,
      });

      await this.index.addSkill({
        name: skillName,
        gistId: gist.id,
        description: gist.description || undefined,
        public: gist.public,
        lastSync: now,
        lastModified: gist.updated_at,
      });

      return { success: true, name: skillName, action: "downloaded", message: `Added ${skillName}` };
    } catch (error) {
      return { success: false, name: gistId, action: "skipped", message: String(error) };
    }
  }

  async removeSkill(name: string, keepLocal = false): Promise<void> {
    await this.storage.removeSource(name);
    await this.index.removeSkill(name);
    if (!keepLocal) {
      const source = await this.storage.getSource(name);
      if (source) {
        await this.storage.deleteLocalSkill(source.localPath);
      }
    }
  }

  private async getRemoteFiles(gist: { files: Record<string, { content?: string; raw_url: string }> }): Promise<SkillFile[]> {
    const files: SkillFile[] = [];
    for (const [filename, file] of Object.entries(gist.files)) {
      const content = file.content ?? await this.client.getGistFileContent(file as any);
      files.push({ filename, content });
    }
    return files;
  }

  private async downloadSkill(localPath: string, files: SkillFile[]): Promise<void> {
    const { mkdir, writeFile } = await import("fs/promises");
    const { join, dirname } = await import("path");

    for (const file of files) {
      const filePath = join(localPath, file.filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
    }
  }
}