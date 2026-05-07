# pi-plan Specification

## Overview

Plan mode for pi — a read-only exploration mode for safe code analysis and structured plan execution.

## Modes

| Mode | Tools | Description |
|------|-------|-------------|
| **normal** | read, bash, edit, write | Default — full access |
| **plan** | read, bash (whitelist), grep, find, ls | Read-only exploration |
| **execute** | read, bash, edit, write | Full access + progress tracking |

## Commands

| Command | Description |
|---------|-------------|
| `/plan` | Toggle plan mode on/off |
| `/plan:status` | Show current plan and progress |

## Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Alt+P` | Toggle plan mode |

## Flags

| Flag | Type | Description |
|------|------|-------------|
| `--plan` | boolean | Start in plan mode |

## Flow

```
normal ──/plan──► plan ──"Execute"──► execute ──(all done)──► normal
                   │                                      ▲
                   └───────────/plan──────────────────────┘
```

1. User runs `/plan` or `--plan` to enter plan mode
2. System injects read-only instructions into prompt
3. LLM analyzes codebase and outputs a `Plan:` section with numbered steps
4. Steps are extracted and displayed in a widget
5. User chooses: Execute / Stay / Refine
6. On execute: tools restored, progress tracked via `[DONE:n]` markers
7. When all steps complete: notification, return to normal mode

## State

State is persisted via `pi.appendEntry("pi-plan", ...)` with branch-aware restoration via `getBranch()`.

## Architecture

```
extensions/plan/index.ts  — Extension entry (commands, events, UI)
src/types.ts              — PlanState, PlanStep, PlanMode
src/safety.ts             — Bash command safety (whitelist/blacklist)
src/planner.ts            — Extract plan steps from LLM output
src/progress.ts           — [DONE:n] parsing and completion stats
```

## Safe Commands (plan mode bash whitelist)

Allowed: cat, head, tail, grep, rg, fd, find, ls, pwd, tree, echo, wc, sort, diff, jq, sed -n, awk, stat, du, git status/log/diff/show/branch, npm list/outdated, curl, etc.

Blocked: rm, mv, cp, mkdir, chmod, git add/commit/push, npm install, sudo, vim, etc.
