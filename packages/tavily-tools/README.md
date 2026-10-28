# pi-tavily-tools

Tavily integration for pi.

## Features

- `tavily_search`
- `tavily_extract`
- `tavily_crawl`
- Rich tool cards: query/URLs, result counts, response time, truncation, and expandable details
- Structured `structuredContent` results for codemode and other programmatic callers
- Preferred JSON-schema constrained sampling for tool arguments
- `/tavily:status` status panel

Requires pi 1.4+ (`@earendil-works/pi-coding-agent`).

## Install

### From npm

```bash
pi install npm:pi-tavily-tools
```

### From local path

```bash
pi install ~/projects/my/pi-packages/packages/tavily-tools
```

## Configure API key

Use one of the following:

```bash
export TAVILY_API_KEY='tvly-xxxxx'
```

or

```bash
mkdir -p ~/.pi/agent
printf '%s' 'tvly-xxxxx' > ~/.pi/agent/tavily.key
```

Then reload pi:

```text
/reload
```

## Usage

- Use Tavily tools when the user asks for web search or known URLs.
- Run `/tavily:status` to open the status panel.

## Publish

```bash
cd ~/projects/my/pi-packages/packages/tavily-tools
npm publish --access public
```

To improve gallery presentation on pi.dev/packages, add an `image` or `video` field under the `pi` key in `package.json`.
