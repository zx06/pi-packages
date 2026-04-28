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

## Gist Naming

Skill Gists use `skill-<name>` as description prefix.