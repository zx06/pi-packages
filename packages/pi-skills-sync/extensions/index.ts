// pi-skills-sync Extension
// Sync pi skills from GitHub Gists

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { GitHubClient, parseGistUrl, openTokenPage } from "../src/github";
import { StorageManager } from "../src/storage";
import { IndexManager } from "../src/index-manager";
import { SyncEngine } from "../src/sync";
import { ConfigManager, type SkillSyncSettings } from "../src/config";

export default function piSkillsSyncExtension(pi: ExtensionAPI) {
  const storage = new StorageManager();
  let client: GitHubClient | null = null;
  let index: IndexManager | null = null;
  let syncEngine: SyncEngine | null = null;

  async function ensureClient(): Promise<GitHubClient> {
    if (!client) {
      const config = await ConfigManager.load();
      if (!config.skillSync?.githubToken) throw new Error("Run /ss:setup first");
      client = new GitHubClient(config.skillSync.githubToken);
      if (!config.skillSync?.indexGistId) throw new Error("Run /ss:setup first");
      index = new IndexManager(client, config.skillSync.indexGistId);
      syncEngine = new SyncEngine(client, storage, index);
    }
    return client;
  }

  // /ss:setup - 首次配置
  pi.registerCommand("ss:setup", {
    description: "Setup token and index Gist",
    handler: async (_args: string, ctx) => {
      const config = await ConfigManager.load();
      ctx.ui.notify(formatConfig(config), "info");
      if (!await ctx.ui.confirm("Setup", "Configure now?")) return;

      // GitHub Token
      let token = config.skillSync?.githubToken;
      if (await ctx.ui.confirm("GitHub", "Create token in browser?")) {
        ctx.ui.notify("🔄 https://github.com/settings/tokens/new?scopes=gist,write:user", "info");
        openTokenPage();
        const input = await ctx.ui.input("Token", "Paste token (ghp_...)");
        token = input?.trim();
        if (token && !(await new GitHubClient(token).validateToken())) { ctx.ui.notify("❌ Invalid", "error"); return; }
      } else if (!token) {
        const input = await ctx.ui.input("Token", "Enter token");
        token = input?.trim();
      }
      if (token) ctx.ui.notify("✅ Token OK", "info");

      // Index Gist
      let indexGistId = config.skillSync?.indexGistId;
      const showGist = (id: string, msg: string) => ctx.ui.notify(`${msg} https://gist.github.com/${id}`, "info");
      
      if (!indexGistId) {
        if (await ctx.ui.confirm("Index", "Create new index Gist?")) {
          ctx.ui.notify("🔄 Creating...", "info");
          const gh = new GitHubClient(token!);
          const gist = await gh.createGist({ description: "pi-skills-sync Index", public: false, files: { "skill-sync-index.json": { content: '{"version":"1","skills":[]}' } } });
          indexGistId = gist.id;
          showGist(indexGistId, "✅ Created!");
        } else {
          ctx.ui.notify("💡 https://gist.github.com", "info");
          const input = await ctx.ui.input("Index Gist ID", "Enter Gist ID");
          indexGistId = input?.trim();
          if (indexGistId) showGist(indexGistId, "📝");
        }
      } else {
        showGist(indexGistId, "Current:");
        if (!await ctx.ui.confirm("Index", "Use this?")) {
          const input = await ctx.ui.input("Index Gist ID", "Enter new ID");
          indexGistId = input?.trim();
          if (indexGistId) showGist(indexGistId, "📝");
        }
      }

      if (!indexGistId) { ctx.ui.notify("⚠️ Index Gist required", "warning"); return; }

      const autoSync = await ctx.ui.confirm("Auto Sync", "Sync on startup?");
      await ConfigManager.save({ githubToken: token, indexGistId, autoSync: Boolean(autoSync) });
      client = index = syncEngine = null;
      ctx.ui.notify("✅ Saved!", "info");
    },
  });

  // /ss:add - 添加 skill
  pi.registerCommand("ss:add", {
    description: "Add skill from Gist URL",
    getArgumentCompletions: async (prefix) => {
      try {
        const config = await ConfigManager.load();
        if (!config.skillSync?.githubToken) return null;
        const gists = await new GitHubClient(config.skillSync.githubToken).listGists();
        return gists.filter(g => g.description?.toLowerCase().startsWith("skill")).map(g => ({ value: g.id, label: `${g.description}` })).filter(i => i.value.startsWith(prefix));
      } catch { return null; }
    },
    handler: async (args: string, ctx) => {
      await ensureClient();
      const url = args.trim();
      if (!url) { ctx.ui.notify("Usage: /ss:add <gist-url>", "info"); return; }
      const gistId = parseGistUrl(url);
      if (!gistId) { ctx.ui.notify("❌ Invalid Gist URL", "error"); return; }
      const result = await syncEngine!.addSkillFromGist(gistId);
      ctx.ui.notify(result.success ? `✅ Added: https://gist.github.com/${gistId}` : `❌ ${result.message}`, result.success ? "info" : "error");
    },
  });

  // /ss:sync - 同步
  pi.registerCommand("ss:sync", {
    description: "Sync skills from Gist",
    getArgumentCompletions: async () => {
      try { return (await storage.listSources()).map(s => ({ value: s.name, label: s.name })); } catch { return null; }
    },
    handler: async (args: string, ctx) => {
      await ensureClient();
      const name = args.trim();
      if (name) {
        const result = await syncEngine!.syncSkill(name);
        ctx.ui.notify(result.success ? `✅ Synced ${name}` : `❌ ${result.message}`, result.success ? "info" : "error");
      } else {
        const results = await syncEngine!.syncAll();
        const ok = results.filter(r => r.success).length;
        ctx.ui.notify(`${ok}/${results.length} synced`, "info");
      }
    },
  });

  // /ss:list - 列出 + 状态
  pi.registerCommand("ss:list", {
    description: "List skills and status",
    handler: async (_args: string, ctx) => {
      try {
        const config = await ConfigManager.load();
        const lines: string[] = [];
        lines.push(`Token: ${config.skillSync?.githubToken ? "✅" : "❌"}`);
        lines.push(`Index: ${config.skillSync?.indexGistId ? "https://gist.github.com/" + config.skillSync.indexGistId : "❌"}`);
        lines.push(`Auto-Sync: ${config.skillSync?.autoSync ?? true ? "✅" : "❌"}`);
        lines.push("");
        
        const sources = await storage.listSources();
        if (sources.length === 0) {
          lines.push("No skills. Use /ss:add or /ss:import");
        } else {
          lines.push(`Skills (${sources.length}):`);
          for (const s of sources) {
            lines.push(`• ${s.name} @ ${s.lastSync ? timeAgo(new Date(s.lastSync)) : "never"}`);
            lines.push(`  https://gist.github.com/${s.gistId}`);
          }
        }
        
        ctx.ui.notify(lines.join("\n"), "info");
      } catch {
        ctx.ui.notify("❌ Run /ss:setup first", "error");
      }
    },
  });

  // /ss:import - 导入本地 skill
  pi.registerCommand("ss:import", {
    description: "Import local skill",
    getArgumentCompletions: async () => {
      try {
        const { readdir, stat } = await import("fs/promises");
        const { homedir } = await import("os");
        const dir = `${homedir()}/.pi/agent/skills`;
        const entries = await readdir(dir).catch(() => []);
        const dirs = [];
        for (const e of entries) {
          try { if ((await stat(`${dir}/${e}`)).isDirectory()) dirs.push({ value: e, label: e }); } catch {}
        }
        return dirs.length ? dirs : null;
      } catch { return null; }
    },
    handler: async (args: string, ctx) => {
      await ensureClient();
      const name = args.trim();
      if (!name) { ctx.ui.notify("Usage: /ss:import <skill-name>", "info"); return; }
      
      const { readFile, readdir, stat } = await import("fs/promises");
      const { homedir } = await import("os");
      const localPath = `${homedir()}/.pi/agent/skills/${name}`;
      
      if (!(await stat(localPath).catch(() => null))?.isDirectory()) {
        ctx.ui.notify(`❌ Not found: ~/.pi/agent/skills/${name}`, "error");
        return;
      }
      
      const files: Record<string, { content: string }> = {};
      async function walk(dir: string, base: string) {
        for (const e of await readdir(dir)) {
          const p = `${dir}/${e}`;
          if ((await stat(p)).isDirectory()) await walk(p, base);
          else files[p.slice(base.length + 1)] = { content: await readFile(p, "utf-8") };
        }
      }
      await walk(localPath, localPath);

      ctx.ui.notify("🔄 Creating Gist...", "info");
      const gh = await ensureClient();
      const gist = await gh.createGist({ description: `skill-${name}`, public: false, files });
      await syncEngine!.addSkillFromGist(gist.id, name);
      ctx.ui.notify(`✅ Imported! https://gist.github.com/${gist.id}`, "info");
    },
  });

  // Auto-sync on startup
  pi.on("agent_start", async () => {
    try {
      const config = await ConfigManager.load();
      if (config.skillSync?.autoSync && config.skillSync?.githubToken && config.skillSync?.indexGistId) {
        const gh = new GitHubClient(config.skillSync.githubToken);
        const idx = new IndexManager(gh, config.skillSync.indexGistId);
        new SyncEngine(gh, storage, idx).syncAll().catch(() => {});
      }
    } catch { /* ignore */ }
  });
}

function formatConfig(c: SkillSyncSettings): string {
  return [
    "Config:",
    `Token: ${c.skillSync?.githubToken ? "✅ set" : "❌ not set"}`,
    `Index: ${c.skillSync?.indexGistId ? c.skillSync.indexGistId.slice(0,8) + "..." : "❌ not set"}`,
    `Auto-Sync: ${c.skillSync?.autoSync ?? true ? "on" : "off"}`,
  ].join("\n");
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
