// Conflict Detection and Resolution

import type { ConflictInfo, SkillFile, SkillSource } from "./types";
import { GitHubClient, deriveSkillName } from "./github";
import { StorageManager } from "./storage";

export class ConflictResolver {
  private client: GitHubClient;
  private storage: StorageManager;

  constructor(client: GitHubClient, storage: StorageManager) {
    this.client = client;
    this.storage = storage;
  }

  async detectConflict(source: SkillSource): Promise<ConflictInfo | null> {
    const remoteGist = await this.client.getGist(source.gistId);
    const remoteModified = new Date(remoteGist.updated_at);
    const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
    let localModified: Date;
    
    if (source.lastSync) {
      localModified = new Date(source.lastSync);
    } else {
      return null;
    }

    if (remoteModified > localModified) {
      const remoteFiles = await this.getRemoteFiles(remoteGist);
      const hasLocalChanges = await this.hasLocalChanges(source, remoteFiles);
      
      if (hasLocalChanges) {
        return {
          name: source.name,
          localPath: source.localPath,
          gistId: source.gistId,
          localModified: localModified.toISOString(),
          remoteModified: remoteModified.toISOString(),
          localFiles: localFiles.map((f) => ({
            filename: f.path,
            content: f.content,
          })),
          remoteFiles,
        };
      }
    }

    return null;
  }

  async resolveWithAgent(
    conflict: ConflictInfo,
    agent: { prompt: (text: string) => Promise<string> }
  ): Promise<"local" | "remote" | "merge"> {
    const report = this.generateConflictReport(conflict);
    const response = await agent.prompt(`
# Sync Conflict: ${conflict.name}

${report}

Options:
1. Keep Local - use your version
2. Use Remote - download remote
3. Merge - help me merge

What to do?
`);
    const normalized = response.toLowerCase().trim();
    if (normalized.includes("remote")) return "remote";
    if (normalized.includes("merge")) return "merge";
    return "local";
  }

  async resolve(conflict: ConflictInfo, strategy: "local" | "remote"): Promise<void> {
    if (strategy === "remote") {
      const remoteGist = await this.client.getGist(conflict.gistId);
      const remoteFiles = await this.getRemoteFiles(remoteGist);
      await this.writeFiles(conflict.localPath, remoteFiles);
    }
  }

  private generateConflictReport(conflict: ConflictInfo): string {
    const lines: string[] = [];
    lines.push(`Local: ${conflict.localModified}`);
    lines.push(`Remote: ${conflict.remoteModified}`);
    lines.push("");
    lines.push("Local Files:");
    for (const f of conflict.localFiles) lines.push(`- ${f.filename}`);
    lines.push("Remote Files:");
    for (const f of conflict.remoteFiles) lines.push(`- ${f.filename}`);
    return lines.join("\n");
  }

  private async getRemoteFiles(gist: { files: Record<string, { content?: string; raw_url: string }> }): Promise<SkillFile[]> {
    const files: SkillFile[] = [];
    for (const [filename, file] of Object.entries(gist.files)) {
      const content = file.content ?? await this.client.getGistFileContent(file as any);
      files.push({ filename, content });
    }
    return files;
  }

  private async hasLocalChanges(source: SkillSource, remoteFiles: SkillFile[]): Promise<boolean> {
    const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
    const localMap = new Map(localFiles.map((f) => [f.path, f.content]));
    const remoteMap = new Map(remoteFiles.map((f) => [f.filename, f.content]));
    
    if (localFiles.length !== remoteFiles.length) return true;
    
    for (const [filename, remoteContent] of remoteMap) {
      const localContent = localMap.get(filename);
      if (!localContent || localContent !== remoteContent) return true;
    }
    
    return false;
  }

  private async writeFiles(basePath: string, files: SkillFile[]): Promise<void> {
    const { mkdir, writeFile } = await import("fs/promises");
    const { join, dirname } = await import("path");
    
    for (const file of files) {
      const filePath = join(basePath, file.filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
    }
  }
}