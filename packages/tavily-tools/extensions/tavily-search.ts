import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerCrawlTool } from "./tavily-search/register-crawl-tool.js";
import { registerExtractTool } from "./tavily-search/register-extract-tool.js";
import { registerSearchTool } from "./tavily-search/register-search-tool.js";
import { showStatus } from "./tavily-search/status.js";

export default function tavilySearchExtension(pi: ExtensionAPI) {
	registerSearchTool(pi);
	registerExtractTool(pi);
	registerCrawlTool(pi);

	pi.registerCommand("tavily:status", {
		description: "Show Tavily config status, usage info, and current session stats",
		handler: async (_args, ctx) => {
			await showStatus(pi, ctx);
		},
	});
}
