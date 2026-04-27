// Core Types for pi-skills-sync

export interface SkillIndex {
  version: "1";
  updatedAt: string;
  skills: SkillEntry[];
}

export interface SkillEntry {
  name: string;
  gistId: string;
  description?: string;
  public: boolean;
  lastSync?: string;
  lastModified?: string;
}

export interface LocalStorage {
  sources: SkillSource[];
}

export interface SkillSource {
  name: string;
  gistId: string;
  owner: string;
  public: boolean;
  localPath: string;
  lastSync?: string;
  lastModified?: string;
  needsSync: boolean;
}

export interface SkillSyncSettings {
  skillSync?: {
    githubToken?: string;
    indexGistId?: string;
    autoSync?: boolean;
  };
}

export interface SkillFile {
  filename: string;
  content: string;
  type?: "file" | "directory";
}

export interface SyncResult {
  success: boolean;
  name: string;
  action: "downloaded" | "uploaded" | "skipped";
  message?: string;
}

// GitHub API Types
export interface GistFile {
  filename: string;
  type: string;
  language: string | null;
  raw_url: string;
  size: number;
  content?: string;
}

export interface Gist {
  id: string;
  description: string | null;
  public: boolean;
  files: Record<string, GistFile>;
  updated_at: string;
  created_at: string;
  owner?: {
    login: string;
  };
}

export interface GistFileUpdate {
  filename?: string;
  content?: string;
}

export interface CreateGistParams {
  description: string;
  public: boolean;
  files: Record<string, { content: string }>;
}
