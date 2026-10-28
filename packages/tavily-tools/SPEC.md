# pi-tavily-tools Specification

## Overview

Tavily web search, extraction, and crawl tools for pi, plus a status panel for
API key and usage information.

## Tools

| Tool | Purpose |
|------|---------|
| `tavily_search` | Search the web with optional answer, raw content, and domain filters |
| `tavily_extract` | Extract the main content of one or more known URLs |
| `tavily_crawl` | Crawl related pages from a starting URL |

All tools:

- use TypeBox parameter schemas
- prefer strict JSON-schema constrained sampling (`constrainedSampling`)
- declare `outputSchema` and return matching `structuredContent`
- render custom call/result cards in the TUI
- truncate model-facing output with the shared truncation helpers and save the
  full text to a temp file when needed

## Structured output

`structured.ts` defines `TavilyOutputSchema` and `buildStructuredContent()`.
The structured shape contains:

- `query`, `answer`, `responseTime`
- `results[]` with `title`, `url`, `content`, `rawContent`, `score`, `images`
- `failedResults[]` with `url`, `error`

The model still receives the formatted text `content`; codemode scripts and other
programmatic callers receive `structuredContent`.

## Rendering

`tool-render.ts` provides `renderTavilyCall()` and `renderTavilyResult()`:

- call line shows the query, URL count, or crawl URL plus topic/depth/limits
- result line shows result/page count, failures, response time, truncation, and
  execution duration
- expanded results show the first lines of formatted output and the full-output
  temp file path
- extract call details and crawl instructions expand with `Ctrl+E`

## Status panel

`/tavily:status` shows:

- API key source and masked key
- account/key usage bars and plan information
- current-session call, result, failure, and truncation statistics
- recent queries and URLs when expanded

The panel fetches usage in the background and re-renders without blocking.

## Configuration

1. `TAVILY_API_KEY` environment variable
2. `~/.pi/agent/tavily.key`

## Architecture

```
extensions/tavily-search.ts              — Extension entry
extensions/tavily-search/register-*.ts   — Tool registration
extensions/tavily-search/params.ts       — TypeBox parameter schemas
extensions/tavily-search/structured.ts   — Output schema + structured results
extensions/tavily-search/tool-render.ts  — TUI call/result renderers
extensions/tavily-search/build-*.ts      — Payload and details builders
extensions/tavily-search/formatters.ts   — Model-facing text formatters
extensions/tavily-search/utils.ts        — API key, truncation, temp files
extensions/tavily-search/status.ts       — Status panel
extensions/tavily-search/api.ts          — Tavily HTTP client
```

## Dependencies

Peer dependencies: `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`,
and `@earendil-works/pi-tui` `^1.4.0`.

`typebox` is not a direct peer dependency: `Type` and `StringEnum` come from
`@earendil-works/pi-ai`, matching the host's bundled TypeBox version.
