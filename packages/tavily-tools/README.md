# pi-tavily-tools

Tavily integration for pi.

## Features

- `tavily_search`
- `tavily_extract`
- `tavily_crawl`
- `/tavily:status` status panel

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
