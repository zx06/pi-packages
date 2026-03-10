import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { postTavily } from "./api.js";
import { buildCrawlPayload } from "./build-payloads.js";
import { buildToolDetails } from "./build-tool-details.js";
import { formatCrawlResults } from "./formatters.js";
import { TavilyCrawlParams } from "./params.js";
import { crawlToolDescription } from "./tool-descriptions.js";
import { truncateForModel } from "./utils.js";

export function registerCrawlTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "tavily_crawl",
		label: "Tavily Crawl",
		description: crawlToolDescription,
		promptSnippet: "Crawl related pages from a starting URL using Tavily",
		promptGuidelines: ["Use this tool when the user wants to explore pages around a site, docs section, or entry URL."],
		parameters: TavilyCrawlParams,
		async execute(_toolCallId, params, signal) {
			const payload = buildCrawlPayload(params);
			const data = await postTavily("crawl", payload, signal);
			const truncated = truncateForModel("crawl", formatCrawlResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: buildToolDetails(data, truncated, {
					url: payload.url,
					instructions: payload.instructions,
					maxDepth: payload.max_depth,
					maxBreadth: payload.max_breadth,
					limit: payload.limit,
					selectPaths: payload.select_paths,
					excludePaths: payload.exclude_paths,
					allowExternal: payload.allow_external,
					extractDepth: payload.extract_depth,
					includeImages: payload.include_images,
				}),
			};
		},
	});
}
