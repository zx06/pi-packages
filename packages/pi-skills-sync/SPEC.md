# pi-skills-sync Specification

## Overview

Manage pi skills via GitHub Gists. Store in private Gists, sync across devices.

## Commands

| Command | Description |
|---------|-------------|
| `/ss:setup` | Interactive setup (token + index Gist) |
| `/ss:add` | Add skill from Gist URL |
| `/ss:import` | Import local skill from ~/.pi/agent/skills |
| `/ss:sync` | Sync all skills or specific one (pull from Gist) |
| `/ss:push` | Push local changes of a skill to its Gist |
| `/ss:remove` | Remove skill from sync list |
| `/ss:list` | List skills + config status |

## Data

- **Config**: `~/.pi/agent/settings.json` (`skillSync` field)
- **Sources**: `~/.pi/agent/skill-sync.json`
- **Index Gist**: Private Gist storing skill registry

## Workflow

1. `/ss:setup` - Create token and index Gist
2. `/ss:add <url>` - Add from Gist
3. `/ss:import <name>` - Import local skill
4. `/ss:sync` - Sync all (pull from Gist)
5. `/ss:push <name>` - Push local changes to Gist
6. `/ss:remove <name>` - Remove from sync list

## Architecture

```
extensions/index.ts      — Commands layer (user-facing)
       ↓
  src/sync.ts            — Sync engine (orchestration)
       ↓
  ┌─────┼─────────┐
  ↓     ↓          ↓
src/     src/       src/
storage  github     index-manager
(Local   (API       (Remote
 JSON)   client)    Index Gist)
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Commands | `extensions/index.ts` | User interaction, autocomplete, confirm dialogs |
| Sync Engine | `src/sync.ts` | Orchestrate pull/push/add/remove across storage and index |
| Local Storage | `src/storage.ts` | Read/write `~/.pi/agent/skill-sync.json` |
| GitHub Client | `src/github.ts` | GitHub Gist REST API wrapper |
| Index Manager | `src/index-manager.ts` | Manage remote Index Gist (skill registry) |
| Config | `src/config.ts` | Read/write `~/.pi/agent/settings.json` |
| Types | `src/types.ts` | Shared TypeScript interfaces |
| Encoding | `src/encoding.ts` | Path encoding for Gist filename safety |
| Utils | `src/utils.ts` | Shared helpers (path resolution, error detection) |

## Encoding Scheme

GitHub Gist API rejects filenames containing `/` (returns 422).
For skills with subdirectories (e.g. `references/concurrency.md`), paths are percent-encoded:

```
/  →  %2F
%  →  %25   (encoded first to avoid decode ambiguity)

Example:
  references/concurrency.md  →  references%2Fconcurrency.md
```

- `encodePath()` in `src/encoding.ts` — used on upload (import, push)
- `decodePath()` in `src/encoding.ts` — used on download (sync, add)

## Gist Naming

Skill Gists use `skill-<name>` as description prefix.