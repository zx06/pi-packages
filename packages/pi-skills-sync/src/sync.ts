// Sync Engine - Core sync orchestration

import type { SyncResult, SkillFile, SkillSource, SkillEntry } from "./types";
import { GitHubClient, deriveSkillName, buildGistDescription } from "./github";
import { StorageManager, resolvePath } from "./storage";
import { IndexManager, resolveSkillPath } from "./index-manager";
import { ConflictResolver } from "./conflict";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, dirname } from "path";

export class SyncEngine {
  private client: GitHubClient;
  private storage: StorageManager;
  private index: IndexManager;
  private conflictResolver: ConflictResolver;
  private conflictStrategy: "agent" | "local" | "remote";

  constructor(
    client: GitHubClient,
    storage: StorageManager,
    index: IndexManager,
    conflictStrategy: "agent" | "local" | "remote" = "agent"
  ) {
    this.client = client;
    this.storage = storage;
    this.index = index;
    this.conflictResolver = new ConflictResolver(client, storage);
    this.conflictStrategy = conflictStrategy;
  }

  setConflictStrategy(strategy: "agent" | "local" | "remote"): void {
    this.conflictStrategy = strategy;
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
      return {
        success: false,
        name,
        action: "skipped",
        message: `Skill "${name}" not found in managed skills`,
      };
    }

    try {
      // Get remote Gist
      const remoteGist = await this.client.getGist(source.gistId);
      const remoteModified = new Date(remoteGist.updated_at);
      const remoteFiles = await this.getRemoteFiles(remoteGist);

      // Check for conflicts
      const conflict = await this.conflictResolver.detectConflict(source);

      if (conflict) {
        return await this.handleConflict(name, conflict);
      }

      // No conflict, download remote
      await this.downloadSkill(source, remoteFiles);

      // Update local storage
      await this.storage.updateSource(name, {
        lastSync: new Date().toISOString(),
        lastModified: remoteModified.toISOString(),
        needsSync: false,
      });

      // Update index
      await this.index.updateSkill(name, {
        lastSync: new Date().toISOString(),
        lastModified: remoteModified.toISOString(),
      });

      return {
        success: true,
        name,
        action: "downloaded",
        message: `Synced "${name}" from remote`,
      };
    } catch (error) {
      return {
        success: false,
        name,
        action: "skipped",
        message: `Failed to sync: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async pushSkill(name: string): Promise<SyncResult> {
    const source = await this.storage.getSource(name);
    if (!source) {
      return {
        success: false,
        name,
        action: "skipped",
        message: `Skill "${name}" not found in managed skills`,
      };
    }

    try {
      // Collect local files
      const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
      const files: Record<string, { content: string }> = {};
      
      for (const file of localFiles) {
        files[file.path] = { content: file.content };
      }

      // Update Gist
      await this.client.updateGist(source.gistId, files);

      // Update local storage
      const now = new Date().toISOString();
      await this.storage.updateSource(name, {
        lastSync: now,
        lastModified: now,
        needsSync: false,
      });

      // Update index
      await this.index.updateSkill(name, {
        lastSync: now,
        lastModified: now,
      });

      return {
        success: true,
        name,
        action: "uploaded",
        message: `Pushed "${name}" to remote`,
      };
    } catch (error) {
      return {
        success: false,
        name,
        action: "skipped",
        message: `Failed to push: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async addSkillFromGist(
    gistIdOrUrl: string,
    overrideName?: string
  ): Promise<SyncResult> {
    try {
      // Parse gist ID if URL provided
      const gistId = this.extractGistId(gistIdOrUrl);
      
      // Fetch Gist
      const gist = await this.client.getGist(gistId);
      
      // Derive name
      const name = overrideName || deriveSkillName(gist.description);
      
      // Check if already exists
      const existing = await this.storage.getSource(name);
      if (existing) {
        return {
          success: false,
          name,
          action: "skipped",
          message: `Skill "${name}" already exists`,
        };
      }

      // Determine local path
      const localPath = resolveSkillPath(name);

      // Create local directory and download files
      const remoteFiles = await this.getRemoteFiles(gist);
      await this.downloadSkillToPath(localPath, remoteFiles);

      // Add to local storage
      await this.storage.addSource({
        name,
        gistId: gist.id,
        owner: gist.owner?.login || "unknown",
        public: gist.public,
        localPath,
        lastSync: new Date().toISOString(),
        lastModified: gist.updated_at,
        needsSync: false,
      });

      // Add to index
      await this.index.addSkill({
        name,
        gistId: gist.id,
        description: gist.description || undefined,
        public: gist.public,
        lastSync: new Date().toISOString(),
        lastModified: gist.updated_at,
      });

      return {
        success: true,
        name,
        action: "downloaded",
        message: `Added skill "${name}" from Gist`,
      };
    } catch (error) {
      return {
        success: false,
        name: gistIdOrUrl,
        action: "skipped",
        message: `Failed to add skill: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async removeSkill(name: string, keepLocal: boolean = false): Promise<void> {
    await this.storage.removeSource(name);
    await this.index.removeSkill(name);
    
    if (!keepLocal) {
      const source = await this.storage.getSource(name);
      if (source) {
        await this.storage.deleteLocalSkill(source.localPath);
      }
    }
  }

  async importFromStorage(filePath: string): Promise<SyncResult[]> {
    // Load external storage file
    const { readFile } = await import("fs/promises");
    const content = await readFile(filePath, "utf-8");
    const externalStorage = JSON.parse(content);

    const results: SyncResult[] = [];
    
    for (const source of externalStorage.sources || []) {
      const result = await this.addSkillFromGist(source.gistId, source.name);
      results.push(result);
    }

    return results;
  }

  private async handleConflict(name: string, conflict: import("./types").ConflictInfo): Promise<SyncResult> {
    switch (this.conflictStrategy) {
      case "remote":
        await this.conflictResolver.resolve(conflict, "remote");
        return {
          success: true,
          name,
          action: "downloaded",
          message: `Conflict resolved by using remote version`,
        };

      case "local":
        return {
          success: true,
          name,
          action: "skipped",
          message: `Local changes detected. Use /ss:push to upload.`,
        };

      case "agent":
      default:
        return {
          success: false,
          name,
          action: "conflict",
          message: `Conflict detected. Use /ss:conflict ${name} to resolve.`,
        };
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

  private async downloadSkill(source: SkillSource, files: SkillFile[]): Promise<void> {
    await this.downloadSkillToPath(source.localPath, files);
  }

  private async downloadSkillToPath(localPath: string, files: SkillFile[]): Promise<void> {
    for (const file of files) {
      const filePath = join(localPath, file.filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
    }
  }

  private extractGistId(input: string): string {
    // Already an ID
    if (/^[a-f0-9]+$/i.test(input)) {
      return input;
    }
    
    // URL
    const match = input.match(/([a-f0-9]{20,})/i);
    if (match) {
      return match[1];
    }
    
    throw new Error(`Invalid Gist ID or URL: ${input}`);
  }
}
