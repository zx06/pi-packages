// Conflict Detection and Resolution

import type { ConflictInfo, SkillFile, SkillSource } from "./types.js";
import { GitHubClient, deriveSkillName } from "./github.js";
import { StorageManager } from "./storage.js";

export class ConflictResolver {
  private client: GitHubClient;
  private storage: StorageManager;

  constructor(client: GitHubClient, storage: StorageManager) {
    this.client = client;
    this.storage = storage;
  }

  async detectConflict(source: SkillSource): Promise<ConflictInfo | null> {
    // Get remote Gist
    const remoteGist = await this.client.getGist(source.gistId);
    const remoteModified = new Date(remoteGist.updated_at);

    // Get local files
    const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
    
    // Check if local was modified since last sync
    let localModified: Date;
    if (source.lastSync) {
      localModified = new Date(source.lastSync);
    } else {
      // No lastSync means never synced, not a conflict
      return null;
    }

    // If remote was modified after last sync
    if (remoteModified > localModified) {
      // Check if local has uncommitted changes (compare file contents)
      // For simplicity, we check if any local file differs from remote
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
    // Generate conflict report
    const report = this.generateConflictReport(conflict);
    
    const prompt = `
# Sync Conflict Detected

There's a sync conflict for skill "${conflict.name}".

## Conflict Report

${report}

## Options

1. **Keep Local** - Use your local version and overwrite remote
2. **Use Remote** - Download and overwrite local with remote version
3. **Merge** - I can help you manually merge the changes

What would you like to do?
`;

    const response = await agent.prompt(prompt);
    
    const normalized = response.toLowerCase().trim();
    if (normalized.includes("remote")) {
      return "remote";
    } else if (normalized.includes("merge")) {
      return "merge";
    }
    return "local";
  }

  async resolve(conflict: ConflictInfo, strategy: "local" | "remote"): Promise<void> {
    if (strategy === "remote") {
      // Download remote and overwrite local
      const remoteGist = await this.client.getGist(conflict.gistId);
      const remoteFiles = await this.getRemoteFiles(remoteGist);
      await this.writeFiles(conflict.localPath, remoteFiles);
    }
    // For "local" strategy, we just keep local and push when needed
  }

  private generateConflictReport(conflict: ConflictInfo): string {
    const lines: string[] = [];
    
    lines.push("### Skill Info");
    lines.push(`- Name: ${conflict.name}`);
    lines.push(`- Gist ID: ${conflict.gistId}`);
    lines.push(`- Local Path: ${conflict.localPath}`);
    lines.push("");
    lines.push("### Timestamps");
    lines.push(`- Local Last Sync: ${conflict.localModified}`);
    lines.push(`- Remote Last Modified: ${conflict.remoteModified}`);
    lines.push("");
    
    lines.push("### Local Files");
    for (const file of conflict.localFiles) {
      lines.push(`- ${file.filename} (${file.content.length} chars)`);
    }
    lines.push("");
    
    lines.push("### Remote Files");
    for (const file of conflict.remoteFiles) {
      lines.push(`- ${file.filename} (${file.content.length} chars)`);
    }
    lines.push("");
    
    // Show file-level diff summary
    lines.push("### File Changes");
    const localNames = new Set(conflict.localFiles.map((f) => f.filename));
    const remoteNames = new Set(conflict.remoteFiles.map((f) => f.filename));
    
    const added = [...remoteNames].filter((n) => !localNames.has(n));
    const removed = [...localNames].filter((n) => !remoteNames.has(n));
    const modified = conflict.localFiles
      .filter((l) => {
        const r = conflict.remoteFiles.find((rf) => rf.filename === l.filename);
        return r && r.content !== l.content;
      })
      .map((l) => l.filename);
    
    if (added.length) lines.push(`- Added: ${added.join(", ")}`);
    if (removed.length) lines.push(`- Removed: ${removed.join(", ")}`);
    if (modified.length) lines.push(`- Modified: ${modified.join(", ")}`);
    
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

  private async hasLocalChanges(
    source: SkillSource,
    remoteFiles: SkillFile[]
  ): Promise<boolean> {
    const localFiles = await this.storage.getLocalSkillFiles(source.localPath);
    const localMap = new Map(localFiles.map((f) => [f.path, f.content]));
    const remoteMap = new Map(remoteFiles.map((f) => [f.filename, f.content]));
    
    // Different number of files
    if (localFiles.length !== remoteFiles.length) {
      return true;
    }
    
    // Check each file
    for (const [filename, remoteContent] of remoteMap) {
      const localContent = localMap.get(filename);
      if (!localContent || localContent !== remoteContent) {
        return true;
      }
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
