# pi-skills-sync Specification

> **Document First Development**: This document defines the complete specification before any code is written. All implementation must match this spec.

## Overview

pi-skills-sync is a pi plugin that syncs skills from remote sources, starting with GitHub Gists. It provides cross-device skill management, conflict resolution, and a pluggable architecture for future remote sources.

## Concepts

### Skill

A skill is a self-contained capability package for pi, following the [Agent Skills standard](https://agentskills.io/specification). It consists of:

- `SKILL.md` - Required metadata and instructions
- Supporting files and directories (scripts, assets, references)

### Remote Source

A remote storage location for skills. The first supported source is GitHub Gist.

### Index Gist

A special private Gist that acts as a registry of all managed skills. It enables cross-device sync and serves as the source of truth.

### Local Storage

`~/.pi/agent/skill-sync.json` stores local state:
- List of managed skills
- GitHub credentials
- Sync metadata

## Commands

All commands are registered with the `/ss:` prefix (skill-sync shorthand).

### `/ss:config`

Configure or update settings.

**Usage:**
```
/ss:config
/ss:config --token <github-token>
/ss:config --index-gist <gist-id>
/ss:config --auto-sync true
/ss:config --sync-interval 3600
/ss:config --conflict-strategy agent
```

**Options:**
| Flag | Type | Description |
|------|------|-------------|
| `--token` | string | GitHub personal access token |
| `--index-gist` | string | Gist ID for skill index |
| `--auto-sync` | boolean | Enable/disable auto sync |
| `--sync-interval` | number | Sync interval in seconds |
| `--conflict-strategy` | string | "agent", "local", or "remote" |

**Behavior:**
- Interactive if no arguments provided
- Validates token by making a test API call
- Saves to settings.json and local storage

---

### `/ss:list`

List all managed skills.

**Usage:**
```
/ss:list
```

**Output:**
```
Managed Skills (3):
├── my-skill (private) [synced 1h ago]
├── pdf-tools (public) [synced 2h ago]
└── code-review (private) [synced 1d ago]
```

**Fields shown:**
- Name
- Public/Private status
- Last sync time (relative)
- Sync status (if out of sync)

---

### `/ss:add`

Add a skill from a Gist URL.

**Usage:**
```
/ss:add <gist-url>
/sS:add <gist-url> --name <optional-name>
```

**Arguments:**
| Argument | Type | Description |
|----------|------|-------------|
| `gist-url` | string | URL of the Gist (e.g., https://gist.github.com/user/abc123) |

**Options:**
| Flag | Type | Description |
|------|------|-------------|
| `--name` | string | Override skill name (default: derived from description) |

**Behavior:**
1. Parse Gist ID from URL
2. Fetch Gist metadata from GitHub API
3. Validate Gist description follows naming convention
4. Create local directory
5. Download all files
6. Add to local storage
7. Update index Gist
8. Print success message

**Naming Convention:**
- Gist description: `skill-<name>`, `SKILL: <name>`, or just `<name>`
- Name extracted: `my-skill` from `skill-my-skill`

---

### `/ss:sync`

Sync skills between local and remote.

**Usage:**
```
/ss:sync           # Sync all skills
/ss:sync <name>    # Sync specific skill
```

**Behavior:**

1. **Fetch Index Gist**: Get latest index from remote
2. **Compare Timestamps**: Check `lastModified` vs `lastSync`
3. **For each skill:**
   - If remote newer: download to local
   - If local newer: prompt to push
   - If same: skip
4. **Update Index**: Push updated index to Gist
5. **Report**: Show sync summary

**Sync Options:**
| Strategy | Behavior |
|----------|----------|
| `agent` (default) | Use pi agent for conflict resolution |
| `local` | Always prefer local changes |
| `remote` | Always prefer remote changes |

---

### `/ss:push`

Push a local skill to its Gist.

**Usage:**
```
/ss:push <name>
```

**Behavior:**
1. Find skill in local storage
2. Collect all files from skill directory
3. Update Gist with new files
4. Update index Gist
5. Update local storage

**Naming in Gist:**
- Description: `skill-<name>`
- Files: Maintain directory structure

---

### `/ss:remove`

Remove a skill from management.

**Usage:**
```
/ss:remove <name>
/ss:remove <name> --keep-local
```

**Options:**
| Flag | Description |
|------|-------------|
| `--keep-local` | Keep local files (default: delete) |

**Behavior:**
1. Confirm with user
2. Remove from local storage
3. Update index Gist
4. Optionally delete local files
5. Print success

---

### `/ss:open`

Open a skill's Gist in the browser.

**Usage:**
```
/sS:open <name>
```

**Behavior:**
Opens `https://gist.github.com/<owner>/<gist-id>` in default browser.

---

### `/ss:conflict`

Resolve a sync conflict with agent assistance.

**Usage:**
```
/ss:conflict <name>
```

**Behavior:**
1. Read local version of skill
2. Read remote version from Gist
3. Generate diff
4. Present to agent with context
5. Agent proposes resolution
6. User approves or modifies
7. Apply resolution and sync

**Conflict Types:**
| Type | Detection | Resolution |
|------|-----------|------------|
| Remote newer | `lastModified` > `lastSync` && local modified | Download remote |
| Local newer | Local `lastSync` < local file mtime | Prompt to push |
| Both modified | Both changed since last sync | Agent merge |

---

### `/ss:import`

Import skills from an existing local storage file.

**Usage:**
```
/sS:import --from <path>
```

**Behavior:**
1. Read source file
2. Validate format
3. Merge with existing skills
4. Sync each skill
5. Update index

---

### `/ss:doctor`

Diagnose common issues.

**Usage:**
```
/ss:doctor
```

**Checks:**
- GitHub token validity
- Index Gist accessibility
- Local storage integrity
- Network connectivity
- Skill directory permissions

## Data Structures

### Index Gist Format

**File:** `skill-sync-index.json`

```typescript
interface SkillIndex {
  version: "1";
  updatedAt: string; // ISO 8601
  skills: SkillEntry[];
}

interface SkillEntry {
  name: string;
  gistId: string;
  description?: string;
  public: boolean;
  lastSync?: string; // ISO 8601
  lastModified?: string; // ISO 8601, from Gist
}
```

### Local Storage Format

**File:** `~/.pi/agent/skill-sync.json`

```typescript
interface LocalStorage {
  sources: SkillSource[];
  githubToken?: string; // Encrypted or omitted if in settings
}

interface SkillSource {
  name: string;
  gistId: string;
  owner: string;
  public: boolean;
  localPath: string; // Absolute path
  lastSync?: string; // ISO 8601
  lastModified?: string; // ISO 8601
  needsSync: boolean;
}
```

### Settings Format

**File:** `~/.pi/agent/settings.json` or `<project>/.pi/settings.json`

```typescript
interface SkillSyncSettings {
  skillSync?: {
    githubToken?: string;
    indexGistId?: string;
    autoSync?: boolean;
    syncInterval?: number; // seconds, 0 = startup only
    conflictStrategy?: "agent" | "local" | "remote";
  };
}
```

## API Design

### GitHub Gist API Endpoints

| Method | Endpoint | Usage |
|--------|----------|-------|
| GET | `/gists` | List user's gists |
| GET | `/gists/:id` | Get gist details |
| POST | `/gists` | Create new gist |
| PATCH | `/gists/:id` | Update gist |
| DELETE | `/gists/:id` | Delete gist |

### Internal Modules

```typescript
// Core modules
ConfigManager     // Settings CRUD, validation
StorageManager    // Local storage CRUD
IndexManager      // Index Gist operations

// Sync modules
SyncEngine        // Orchestrates sync operations
ConflictResolver  // Detects and resolves conflicts

// Adapters
GistAdapter       // GitHub Gist API integration
```

## Error Handling

| Error | Behavior |
|-------|----------|
| Invalid token | Prompt to reconfigure |
| Gist not found | Offer to remove from management |
| Network error | Retry with backoff, then report |
| Invalid Gist format | Report which file is missing |
| Permission denied | Explain and suggest fix |

## Security Considerations

1. **Token Storage**: Store in `settings.json` or environment variable, not in plain local storage
2. **Private Gists**: Require authentication to access
3. **Credential Validation**: Test token before saving
4. **No Secret Injection**: Don't pass tokens to LLM

## Future Extensibility

The adapter pattern allows adding new sources:

```typescript
interface SourceAdapter {
  name: string;
  listSkills(): Promise<SkillEntry[]>;
  getSkill(id: string): Promise<SkillFile[]>;
  pushSkill(name: string, files: SkillFile[]): Promise<void>;
  deleteSkill(id: string): Promise<void>;
}

// Planned adapters
GistAdapter       // Current: GitHub Gists
RepoAdapter       // Future: GitHub repos with skill directories
GitLabAdapter     // Future: GitLab snippets
FileAdapter       // Future: Local/remote file-based sync
```

## Acceptance Criteria

- [ ] All 9 commands implemented and working
- [ ] Index Gist sync works correctly
- [ ] Multi-file skills sync correctly
- [ ] Conflict detection works
- [ ] Agent-assisted conflict resolution works
- [ ] Settings persistence works
- [ ] Error handling provides useful messages
- [ ] Documentation is complete
- [ ] Tests cover core functionality

## Out of Scope (v1)

- Multiple remote sources for same skill
- Skill version history
- Skill publishing/sharing marketplace
- Two-way real-time sync
- Non-GitHub Gist sources
