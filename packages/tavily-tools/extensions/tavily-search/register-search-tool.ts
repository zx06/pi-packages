import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { postTavily } from "./api.js";
import { buildSearchPayload } from "./build-payloads.js";
import { buildToolDetails } from "./build-tool-details.js";
import { formatSearchResults } from "./formatters.js";
import { TavilySearchParams } from "./params.js";
import { searchToolDescription } from "./tool-descriptions.js";
import { truncateForModel } from "./utils.js";

export function registerSearchTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "tavily_search",
		label: "Tavily Search",
		description: searchToolDescription,
		promptSnippet: "Search the web using Tavily for up-to-date information and relevant web pages",
		promptGuidelines: [
			"Use this tool when the user explicitly asks for web search, latest information, official websites, or news.",
			"Use read/bash/grep/find for local repository search instead of Tavily.",
		],
		parameters: TavilySearchParams,
		async execute(_toolCallId, params, signal) {
			const payload = buildSearchPayload(params);
			const data = await postTavily("search", payload, signal);
			const truncated = truncateForModel("search", formatSearchResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: buildToolDetails(data, truncated, {
					query: payload.query,
					topic: payload.topic,
					searchDepth: payload.search_depth,
					maxResults: payload.max_results,
					includeAnswer: payload.include_answer,
					includeRawContent: payload.include_raw_content,
					includeDomains: payload.include_domains,
					excludeDomains: payload.exclude_domains,
				}),
			};
		},
	});
}
