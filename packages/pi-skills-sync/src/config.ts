// Configuration Manager

import { readFile, writeFile, mkdir } from "fs/promises";
import type { SkillSyncSettings } from "./types";
import { resolvePath, isFileNotFound } from "./utils";

export type { SkillSyncSettings };

const SETTINGS_PATH = "~/.pi/agent/settings.json";

export class ConfigManager {
  private static settingsPath: string = resolvePath(SETTINGS_PATH);

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
}
