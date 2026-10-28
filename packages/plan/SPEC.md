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

## Events

| Event | Purpose |
|-------|---------|
| `tool_call` | Blocks `write`/`edit` and unsafe `bash`; blocked calls return `terminate: true` |
| `user_bash` | Applies the same read-only whitelist to user `!` / `!!` commands |
| `before_agent_start` | Injects plan/execute instructions for user prompts only |
| `context` | Removes stale plan-mode messages when not in plan mode |
| `turn_end` | Parses `[DONE:n]` markers and persists progress |
| `agent_settled` | After retries/compaction/queueing settle: extracts the plan or checks completion |
| `session_start` | Restores branch-aware state and the `--plan` flag |

`agent_settled` is used instead of `agent_end` because pi documents `agent_end`
as not being a final-idle signal.

## Rendering

- `registerMessageRenderer` draws plan todo/complete/execute messages as
  expandable checklist cards with structured `details.steps`.
- `registerMarkdownTransformer` renders `[DONE:n]` as `` `✓ step n` `` outside
  fenced code blocks. Raw text still drives progress tracking.
- The progress widget and status line continue to show live completion.

## State

State is persisted via `pi.appendEntry("pi-plan", ...)` with branch-aware restoration via `getBranch()`.

## Architecture

```
extensions/plan/index.ts  — Extension entry (commands, events, UI)
extensions/plan/render.ts — Checklist message cards + [DONE:n] display transform
src/types.ts              — PlanState, PlanStep, PlanMode, PlanMessageDetails
src/safety.ts             — Bash command safety (whitelist/blacklist)
src/planner.ts            — Extract plan steps from LLM output
src/progress.ts           — [DONE:n] parsing and completion stats
```

## Safe Commands (plan mode bash whitelist)

Allowed: cat, head, tail, grep, rg, fd, find, ls, pwd, tree, echo, wc, sort, diff, jq, sed -n, awk, stat, du, git status/log/diff/show/branch, npm list/outdated, curl, etc.

Blocked: rm, mv, cp, mkdir, chmod, git add/commit/push, npm install, sudo, vim, etc.

## Dependencies

Peer dependencies: `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` `^1.4.0`.
