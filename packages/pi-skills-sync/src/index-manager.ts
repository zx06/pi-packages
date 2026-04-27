// Index Gist Management

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { SkillIndex, SkillEntry, SkillFile } from "./types";
import { GitHubClient, deriveSkillName } from "./github";

const INDEX_FILENAME = "skill-sync-index.json";

export class IndexManager {
  private client: GitHubClient;
  private indexGistId: string;

  constructor(client: GitHubClient, indexGistId: string) {
    this.client = client;
    this.indexGistId = indexGistId;
  }

  async load(): Promise<SkillIndex> {
    const gist = await this.client.getGist(this.indexGistId);
    const indexFile = gist.files[INDEX_FILENAME];
    
    if (!indexFile) {
      // Create new index
      return {
        version: "1",
        updatedAt: new Date().toISOString(),
        skills: [],
      };
    }

    const content = indexFile.content || await this.client.getGistFileContent(indexFile);
    try {
      return JSON.parse(content) as SkillIndex;
    } catch {
      throw new Error("Invalid index Gist format: skill-sync-index.json is not valid JSON");
    }
  }

  async save(index: SkillIndex): Promise<void> {
    index.updatedAt = new Date().toISOString();
    
    await this.client.updateGist(this.indexGistId, {
      [INDEX_FILENAME]: {
        filename: INDEX_FILENAME,
        content: JSON.stringify(index, null, 2),
      },
    });
  }

  async addSkill(entry: SkillEntry): Promise<void> {
    const index = await this.load();
    
    const existing = index.skills.findIndex((s) => s.name === entry.name);
    if (existing >= 0) {
      index.skills[existing] = entry;
    } else {
      index.skills.push(entry);
    }

    await this.save(index);
  }

  async removeSkill(name: string): Promise<void> {
    const index = await this.load();
    index.skills = index.skills.filter((s) => s.name !== name);
    await this.save(index);
  }

  async getSkill(name: string): Promise<SkillEntry | undefined> {
    const index = await this.load();
    return index.skills.find((s) => s.name === name);
  }

  async listSkills(): Promise<SkillEntry[]> {
    const index = await this.load();
    return index.skills;
  }

  async updateSkill(name: string, updates: Partial<SkillEntry>): Promise<void> {
    const index = await this.load();
    const skill = index.skills.find((s) => s.name === name);
    if (skill) {
      Object.assign(skill, updates);
      await this.save(index);
    }
  }

  async getIndexGistId(): Promise<string> {
    return this.indexGistId;
  }

  async createIndexGistIfNotExists(): Promise<string> {
    try {
      const gist = await this.client.getGist(this.indexGistId);
      // Verify it has the index file
      if (!gist.files[INDEX_FILENAME]) {
        await this.save({
          version: "1",
          updatedAt: new Date().toISOString(),
          skills: [],
        });
      }
      return this.indexGistId;
    } catch {
      // Gist doesn't exist, create it
      const gist = await this.client.createGist({
        description: "pi-skills-sync Index",
        public: false,
        files: {
          [INDEX_FILENAME]: {
            content: JSON.stringify({
              version: "1",
              updatedAt: new Date().toISOString(),
              skills: [],
            }, null, 2),
          },
        },
      });
      return gist.id;
    }
  }
}

// Resolve path with ~ expansion
export function resolveSkillPath(name: string, baseDir?: string): string {
  const base = baseDir || "~/.pi/agent/skills";
  const resolved = base.startsWith("~/")
    ? join(homedir(), base.slice(2))
    : base;
  return join(resolved, name);
}
