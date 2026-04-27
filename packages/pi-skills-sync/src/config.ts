// Configuration Manager

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";
import type { SkillSyncSettings } from "./types.ts";

export type { SkillSyncSettings };

const SETTINGS_PATH = "~/.pi/agent/settings.json";

export class ConfigManager {
  private static settingsPath: string;

  static {
    this.settingsPath = resolvePath(SETTINGS_PATH);
  }

  static setSettingsPath(path: string): void {
    this.settingsPath = resolvePath(path);
  }

  static async load(): Promise<SkillSyncSettings> {
    try {
      const content = await readFile(this.settingsPath, "utf-8");
      const settings = JSON.parse(content) as SkillSyncSettings;
      
      // Apply environment variable overrides
      if (process.env.GITHUB_TOKEN && !settings.skillSync?.githubToken) {
        if (!settings.skillSync) {
          settings.skillSync = {};
        }
        settings.skillSync.githubToken = process.env.GITHUB_TOKEN;
      }
      
      return settings;
    } catch (error) {
      if (isFileNotFound(error)) {
        return {};
      }
      throw error;
    }
  }

  static async save(options: Partial<SkillSyncSettings["skillSync"]>): Promise<void> {
    const settings = await this.load();
    
    if (!settings.skillSync) {
      settings.skillSync = {};
    }
    
    // Merge options
    Object.assign(settings.skillSync, options);
    
    // Ensure directory exists
    const dir = this.settingsPath.substring(0, this.settingsPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    
    await writeFile(this.settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  }

  static async get<K extends keyof SkillSyncSettings["skillSync"]>(
    key: K
  ): Promise<SkillSyncSettings["skillSync"][K] | undefined> {
    const settings = await this.load();
    return settings.skillSync?.[key];
  }

  static async set<K extends keyof SkillSyncSettings["skillSync"]>(
    key: K,
    value: SkillSyncSettings["skillSync"][K]
  ): Promise<void> {
    await this.save({ [key]: value });
  }

  static async reset(): Promise<void> {
    await this.save({
      githubToken: undefined,
      indexGistId: undefined,
      autoSync: undefined,
      syncInterval: undefined,
      conflictStrategy: undefined,
    });
  }
}

function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }
  return resolve(path);
}

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    ("code" in error ? error.code === "ENOENT" : error.message.includes("ENOENT"))
  );
}
