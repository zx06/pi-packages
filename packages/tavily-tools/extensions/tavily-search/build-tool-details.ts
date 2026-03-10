import type { TavilyResponse, ToolDetails, TruncatedOutput } from "./types.js";

export function buildToolDetails(
	data: TavilyResponse,
	truncated: TruncatedOutput,
	base: Omit<ToolDetails, "responseTime" | "resultCount" | "failedCount" | "truncated" | "truncation" | "fullOutputPath">,
): ToolDetails {
	return {
		...base,
		responseTime: data.response_time,
		resultCount: data.results?.length ?? 0,
		failedCount: data.failed_results?.length ?? 0,
		truncated: truncated.truncated,
		truncation: truncated.truncation,
		fullOutputPath: truncated.fullOutputPath,
	};
}
