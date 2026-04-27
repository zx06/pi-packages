# pi-skills-sync

Manage your pi skills via GitHub Gists. Sync across devices, import local skills, backup to the cloud.

## What is this?

`pi-skills-sync` is a pi plugin for managing personal skills using GitHub Gists as storage. 
- Store skills in private Gists
- Sync across multiple machines via an index Gist
- Import existing local skills

## Commands

| Command | Description |
|---------|-------------|
| `/ss:setup` | Interactive setup (token + index Gist) |
| `/ss:add` | Add skill from Gist URL |
| `/ss:import` | Import local skill from ~/.pi/agent/skills |
| `/ss:sync` | Sync all skills or a specific one |
| `/ss:list` | List skills + config status |

## Quick Start

```bash
# 1. Install
pi install npm:pi-skills-sync

# 2. Setup (first time)
/ss:setup

# 3. Add a skill from Gist
/ss:add https://gist.github.com/yourname/abc123

# 4. Import local skill
/ss:import my-local-skill

# 5. Sync
/ss:sync

# 6. List all
/ss:list
```

## Workflow

### First Time Setup
```
/ss:setup
→ Create GitHub token (opens browser) or enter manually
→ Create or enter index Gist ID
→ Auto-sync? Yes/No
→ Saved!
```

### Adding a Skill
- From someone else's Gist: `/ss:add <gist-url>`
- From your own Gist: Tab completion shows your gists starting with "skill"

### Importing Local Skill
```
/ss:import my-skill
→ Reads ~/.pi/agent/skills/my-skill
→ Creates new private Gist
→ Adds to management list
```

### Syncing
- `/ss:sync` - sync all
- `/ss:sync my-skill` - sync specific

## Index Gist

The index Gist is a private Gist that stores:
- List of all managed skills
- Skill names and Gist IDs
- Last sync timestamps

Save the index Gist ID somewhere safe - you'll need it to restore on new machines.

## On a New Machine

```bash
# Install plugin
pi install npm:pi-skills-sync

# Setup
/ss:setup
→ Enter GitHub token
→ Enter your saved index Gist ID

# Sync
/ss:sync → pulls all your skills!
```

## Configuration

Stored in `~/.pi/agent/settings.json`:
```json
{
  "skillSync": {
    "githubToken": "ghp_...",
    "indexGistId": "abc123...",
    "autoSync": true
  }
}
```

## Auto-Sync

When enabled, skills sync on every pi startup. Can be disabled during setup.

## License

MIT