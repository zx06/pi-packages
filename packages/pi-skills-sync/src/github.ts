// GitHub Gist API Client

import type { Gist, GistFile, CreateGistParams, GistFileUpdate } from "./types";

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const error = await response.json() as { message?: string };
        message = error.message || message;
      } catch {
        // ignore
      }
      throw new GitHubError(
        response.status,
        response.statusText,
        message
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request<{ login: string }>("GET", "/user");
      return true;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 401) {
        return false;
      }
      throw error;
    }
  }

  async getCurrentUser(): Promise<{ login: string; name: string | null }> {
    return this.request("GET", "/user");
  }

  async listGists(): Promise<Gist[]> {
    return this.request<Gist[]>("GET", "/gists");
  }

  async getGist(gistId: string): Promise<Gist> {
    return this.request<Gist>("GET", `/gists/${gistId}`);
  }

  async createGist(params: CreateGistParams): Promise<Gist> {
    return this.request<Gist>("POST", "/gists", {
      description: params.description,
      public: params.public,
      files: params.files,
    });
  }

  async updateGist(
    gistId: string,
    files: Record<string, GistFileUpdate | null>
  ): Promise<Gist> {
    return this.request<Gist>("PATCH", `/gists/${gistId}`, { files });
  }

  async deleteGist(gistId: string): Promise<void> {
    await this.request<void>("DELETE", `/gists/${gistId}`);
  }

  async getGistFileContent(file: GistFile): Promise<string> {
    if (file.content !== undefined) {
      return file.content;
    }
    const response = await fetch(file.raw_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }
    return response.text();
  }
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

// Parse Gist URL to extract ID
export function parseGistUrl(url: string): string | null {
  const patterns = [
    /gist\.github\.com\/(?:[a-zA-Z0-9-]+\/)?([a-f0-9]+)/i,
    /^([a-f0-9]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Derive skill name from Gist description
export function deriveSkillName(description: string | null): string {
  if (!description) {
    throw new Error("Gist description is required for skill naming");
  }

  if (description.toLowerCase().startsWith("skill-")) {
    return description.slice(6).trim();
  }

  if (description.toUpperCase().startsWith("SKILL:")) {
    return description.slice(6).trim();
  }

  return description.trim();
}

// Build Gist description from skill name
export function buildGistDescription(name: string): string {
  return `skill-${name}`;
}

// Open GitHub token page
export function openTokenPage(): void {
  openUrl("https://github.com/settings/tokens/new?scopes=gist,write:user&description=pi-skills-sync");
}

function openUrl(url: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exec } = require("child_process");
    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${openCmd} "${url}"`);
  } catch {
    // If fails, don't crash - caller will handle
  }
}