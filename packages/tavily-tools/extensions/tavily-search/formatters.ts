import { TAVILY_DOCS_URL } from "./constants.js";
import type { SessionUsageStats, TavilyFailedResult, TavilyResponse, TavilyUsageBreakdown, TavilyUsageResponse } from "./types.js";
import { compactText, shorten } from "./utils.js";

function formatFailedResults(failed: TavilyFailedResult[] | undefined): string[] {
	if (!failed?.length) return [];

	const lines = ["", `Failed Results (${failed.length}):`];
	for (const item of failed) {
		const target = item.url || "(unknown url)";
		const message = item.error ? ` - ${item.error}` : "";
		lines.push(`- ${target}${message}`);
	}
	return lines;
}

export function formatSearchResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (data.query) lines.push(`Query: ${data.query}`);
	if (typeof data.response_time === "number") lines.push(`Response Time: ${data.response_time}s`);
	if (lines.length > 0) lines.push("");

	if (data.answer) {
		lines.push("Answer:");
		lines.push(data.answer.trim());
		lines.push("");
	}

	if (!data.results?.length) {
		lines.push("No search results found.");
		lines.push(...formatFailedResults(data.failed_results));
		return lines.join("\n").trim();
	}

	lines.push(`Results (${data.results.length}):`);
	lines.push("");

	for (const [index, item] of data.results.entries()) {
		lines.push(`${index + 1}. ${item.title?.trim() || "(untitled)"}`);
		if (item.url) lines.push(`URL: ${item.url}`);
		if (typeof item.score === "number") lines.push(`Score: ${item.score.toFixed(3)}`);
		const summary = shorten(item.content, 700);
		if (summary) lines.push(`Snippet: ${summary}`);
		const raw = shorten(item.raw_content, 1600);
		if (raw) lines.push(`Raw Content: ${raw}`);
		if (item.images?.length) lines.push(`Images: ${item.images.slice(0, 8).join(", ")}`);
		lines.push("");
	}

	lines.push(...formatFailedResults(data.failed_results));
	return lines.join("\n").trim();
}

export function formatExtractResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (typeof data.response_time === "number") {
		lines.push(`Response Time: ${data.response_time}s`);
		lines.push("");
	}

	if (!data.results?.length) {
		lines.push("No extractable results found.");
		lines.push(...formatFailedResults(data.failed_results));
		return lines.join("\n").trim();
	}

	lines.push(`Extract Results (${data.results.length}):`);
	lines.push("");
	for (const [index, item] of data.results.entries()) {
		lines.push(`${index + 1}. ${item.title?.trim() || item.url || "(untitled)"}`);
		if (item.url) lines.push(`URL: ${item.url}`);
		const body = shorten(item.raw_content || item.content, 5000);
		if (body) lines.push(`Content: ${body}`);
		if (item.images?.length) lines.push(`Images: ${item.images.slice(0, 10).join(", ")}`);
		lines.push("");
	}

	lines.push(...formatFailedResults(data.failed_results));
	return lines.join("\n").trim();
}

export function formatCrawlResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (data.base_url) lines.push(`Base URL: ${data.base_url}`);
	if (typeof data.response_time === "number") lines.push(`Response Time: ${data.response_time}s`);
	if (lines.length > 0) lines.push("");

	if (!data.results?.length) {
		lines.push("No pages were crawled.");
		lines.push(...formatFailedResults(data.failed_results));
		return lines.join("\n").trim();
	}

	lines.push(`Crawl Results (${data.results.length}):`);
	lines.push("");

	for (const [index, item] of data.results.entries()) {
		lines.push(`${index + 1}. ${item.title?.trim() || item.url || "(untitled)"}`);
		if (item.url) lines.push(`URL: ${item.url}`);
		const summary = shorten(item.content, 900);
		if (summary) lines.push(`Snippet: ${summary}`);
		const raw = shorten(item.raw_content, 2200);
		if (raw) lines.push(`Raw Content: ${raw}`);
		if (item.images?.length) lines.push(`Images: ${item.images.slice(0, 10).join(", ")}`);
		lines.push("");
	}

	lines.push(...formatFailedResults(data.failed_results));
	return lines.join("\n").trim();
}

function toNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function extractSessionUsageStats(ctx: any): SessionUsageStats {
	const stats: SessionUsageStats = {
		totalCalls: 0,
		searchCalls: 0,
		extractCalls: 0,
		crawlCalls: 0,
		failedCalls: 0,
		truncatedCalls: 0,
		totalResults: 0,
		totalFailedResults: 0,
		recentQueries: [],
		recentUrls: [],
	};

	const responseTimes: number[] = [];
	const recentQueries: string[] = [];
	const recentUrls: string[] = [];
	const branch = ctx.sessionManager.getBranch() as any[];

	for (const entry of branch) {
		if (entry?.type !== "message") continue;
		const message = entry.message;
		if (message?.role !== "toolResult") continue;

		const toolName = message.toolName;
		if (!["tavily_search", "tavily_extract", "tavily_crawl"].includes(toolName)) continue;

		stats.totalCalls += 1;
		if (toolName === "tavily_search") stats.searchCalls += 1;
		if (toolName === "tavily_extract") stats.extractCalls += 1;
		if (toolName === "tavily_crawl") stats.crawlCalls += 1;
		if (message.isError) stats.failedCalls += 1;

		const details = (message.details ?? {}) as Record<string, unknown>;
		if (details.truncated === true) stats.truncatedCalls += 1;
		stats.totalResults += toNumber(details.resultCount) ?? 0;
		stats.totalFailedResults += toNumber(details.failedCount) ?? 0;

		const responseTime = toNumber(details.responseTime);
		if (responseTime !== undefined) responseTimes.push(responseTime);

		const query = typeof details.query === "string" ? compactText(details.query) : "";
		if (query) recentQueries.push(query);

		const url = typeof details.url === "string" ? compactText(details.url) : "";
		if (url) recentUrls.push(url);

		const urls = Array.isArray(details.urls) ? details.urls.filter((item): item is string => typeof item === "string") : [];
		for (const item of urls) {
			const normalized = compactText(item);
			if (normalized) recentUrls.push(normalized);
		}

		const timestamp = entry.message?.timestamp ?? entry.timestamp;
		if (typeof timestamp === "number") {
			stats.firstUsedAt = stats.firstUsedAt === undefined ? timestamp : Math.min(stats.firstUsedAt, timestamp);
			stats.lastUsedAt = stats.lastUsedAt === undefined ? timestamp : Math.max(stats.lastUsedAt, timestamp);
		}
	}

	if (responseTimes.length > 0) {
		stats.averageResponseTimeSec = responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length;
	}

	stats.recentQueries = recentQueries.slice(-5).reverse();
	stats.recentUrls = Array.from(new Set(recentUrls)).slice(-5).reverse();
	return stats;
}

function formatTimestamp(timestamp: number | undefined): string {
	if (timestamp === undefined) return "-";
	return new Date(timestamp).toLocaleString("en-CA", { hour12: false });
}

function formatMaybeNumber(value: number | undefined): string {
	return value === undefined ? "-" : String(value);
}

function renderBar(percent: number | undefined, width = 24): string {
	if (percent === undefined || !Number.isFinite(percent)) {
		return "░".repeat(width);
	}

	const ratio = Math.max(0, Math.min(percent / 100, 1));
	const filled = Math.round(width * ratio);
	return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function getPercentNumber(usage: number | undefined, limit: number | undefined): number | undefined {
	if (usage === undefined || limit === undefined || !Number.isFinite(limit) || limit <= 0) {
		return undefined;
	}
	return (usage / limit) * 100;
}

function formatUsageSummary(usage: TavilyUsageBreakdown | undefined): string {
	if (!usage) return "no data";
	const totalUsage = usage.usage ?? usage.plan_usage;
	const totalLimit = usage.limit ?? usage.plan_limit;
	const percent = getPercentNumber(totalUsage, totalLimit);
	return `${formatMaybeNumber(totalUsage)} / ${formatMaybeNumber(totalLimit)}${percent !== undefined ? ` (${percent.toFixed(1)}%)` : ""}`;
}

function formatBreakdownParts(usage: TavilyUsageBreakdown | undefined): string[] {
	if (!usage) return [];
	const breakdown: Array<[string, number | undefined]> = [
		["search", usage.search_usage],
		["extract", usage.extract_usage],
		["crawl", usage.crawl_usage],
		["map", usage.map_usage],
		["research", usage.research_usage],
	];
	return breakdown.filter(([, value]) => value !== undefined).map(([name, value]) => `${name}=${value}`);
}

function colorForPercent(theme: any, percent: number | undefined, text: string): string {
	if (percent === undefined) return theme.fg("muted", text);
	if (percent >= 90) return theme.fg("error", text);
	if (percent >= 70) return theme.fg("warning", text);
	return theme.fg("success", text);
}

export function buildStatusPanelLines(details: {
	configured: boolean;
	apiKeySource?: string;
	apiKeyMasked?: string;
	usage?: TavilyUsageResponse;
	usageError?: string;
	sessionStats: SessionUsageStats;
	guidance?: string;
}, theme: any, expanded: boolean): string[] {
	const sessionStats = details.sessionStats;
	const keyUsage = details.usage?.key;
	const accountUsage = details.usage?.account;
	const keyPercent = getPercentNumber(keyUsage?.usage ?? keyUsage?.plan_usage, keyUsage?.limit ?? keyUsage?.plan_limit);
	const accountPercent = getPercentNumber(accountUsage?.usage ?? accountUsage?.plan_usage, accountUsage?.limit ?? accountUsage?.plan_limit);

	const lines: string[] = [];
	const title = details.configured
		? `${theme.fg("success", "●")} ${theme.bold("Tavily Status")} ${theme.fg("muted", "ready")}`
		: `${theme.fg("warning", "●")} ${theme.bold("Tavily Status")} ${theme.fg("warning", "not configured")}`;
	lines.push(title);

	if (details.apiKeyMasked) {
		const sourceText = details.apiKeySource ? ` · ${details.apiKeySource}` : "";
		lines.push(`${theme.fg("accent", "Key")} ${theme.fg("dim", details.apiKeyMasked + sourceText)}`);
	}

	if (!details.configured) {
		lines.push("", theme.fg("warning", "Configure an API key, run /reload, then run /tavily:status again."));
		if (expanded && details.guidance) lines.push("", theme.fg("dim", details.guidance));
	} else {
		lines.push("", theme.bold("Usage"));
		lines.push(`${theme.fg("accent", "Key ")} ${colorForPercent(theme, keyPercent, renderBar(keyPercent, expanded ? 24 : 18))} ${theme.fg("muted", formatUsageSummary(keyUsage))}`);
		lines.push(`${theme.fg("accent", "Acct")} ${colorForPercent(theme, accountPercent, renderBar(accountPercent, expanded ? 24 : 18))} ${theme.fg("muted", formatUsageSummary(accountUsage))}`);
		if (expanded && keyUsage) {
			const parts = formatBreakdownParts(keyUsage);
			if (parts.length > 0) lines.push(`${theme.fg("dim", `key: ${parts.join("  ")}`)}`);
		}
		if (expanded && accountUsage) {
			const plan = accountUsage.current_plan ? `plan=${accountUsage.current_plan}  ` : "";
			const parts = formatBreakdownParts(accountUsage);
			lines.push(`${theme.fg("dim", `${plan}${parts.join("  ")}`.trim())}`);
		}
		if (details.usageError) lines.push("", `${theme.fg("warning", "Usage error:")} ${theme.fg("muted", details.usageError)}`);
	}

	lines.push("", theme.bold("Session"));
	lines.push(`${theme.fg("accent", "Calls")} ${theme.bold(String(sessionStats.totalCalls))}  ${theme.fg("muted", `s=${sessionStats.searchCalls}  e=${sessionStats.extractCalls}  c=${sessionStats.crawlCalls}`)}`);
	lines.push(`${theme.fg("accent", "Stats")} ${theme.bold(String(sessionStats.totalResults))} ${theme.fg("muted", "results")}  ${theme.fg("muted", `failed=${sessionStats.failedCalls}  trunc=${sessionStats.truncatedCalls}  avg=${sessionStats.averageResponseTimeSec ? `${sessionStats.averageResponseTimeSec.toFixed(2)}s` : "-"}`)}`);

	if (expanded) lines.push(theme.fg("dim", `first=${formatTimestamp(sessionStats.firstUsedAt)}  last=${formatTimestamp(sessionStats.lastUsedAt)}`));

	if (sessionStats.recentQueries.length > 0) {
		lines.push("", theme.bold(expanded ? "Recent queries" : "Recent"));
		for (const query of sessionStats.recentQueries.slice(0, expanded ? 4 : 2)) {
			lines.push(`${theme.fg("success", "•")} ${query}`);
		}
	}

	if (expanded && sessionStats.recentUrls.length > 0) {
		lines.push("", theme.bold("Recent URLs"));
		for (const url of sessionStats.recentUrls.slice(0, 3)) {
			lines.push(`${theme.fg("accent", "•")} ${theme.fg("muted", url)}`);
		}
	}

	lines.push("", theme.fg("dim", expanded ? "e collapse • Enter/q/Esc close" : "e expand • Enter/q/Esc close"));

	if (expanded) {
		lines.push("", theme.bold("Notes"));
		lines.push(theme.fg("dim", "• Reduce include_raw_content, max_results, or crawl limit if usage gets high"));
		lines.push(theme.fg("dim", "• Use read on fullOutputPath if a result was truncated"));
		lines.push(theme.fg("dim", `• Usage docs: ${TAVILY_DOCS_URL}`));
	}

	return lines;
}
