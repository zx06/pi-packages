import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { postTavily } from "./api.js";
import { buildExtractPayload } from "./build-payloads.js";
import { buildToolDetails } from "./build-tool-details.js";
import { formatExtractResults } from "./formatters.js";
import { TavilyExtractParams } from "./params.js";
import { extractToolDescription } from "./tool-descriptions.js";
import { truncateForModel } from "./utils.js";

export function registerExtractTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "tavily_extract",
		label: "Tavily Extract",
		description: extractToolDescription,
		promptSnippet: "Extract the main content of one or more web pages using Tavily",
		promptGuidelines: ["Use this tool when you already know the target URL and need the page content."],
		parameters: TavilyExtractParams,
		async execute(_toolCallId, params, signal) {
			const payload = buildExtractPayload(params);
			const data = await postTavily("extract", payload, signal);
			const truncated = truncateForModel("extract", formatExtractResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: buildToolDetails(data, truncated, {
					urls: payload.urls,
					urlCount: payload.urls.length,
					extractDepth: payload.extract_depth,
					includeImages: payload.include_images,
				}),
			};
		},
	});
}
