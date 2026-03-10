import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationResult,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Box, Key, matchesKey, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const REQUEST_TIMEOUT_MS = 45_000;
const USAGE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_URLS_PER_EXTRACT = 20;
const MAX_DOMAINS = 20;
const KEY_FILE_PATH = join(homedir(), ".pi", "agent", "tavily.key");
const TAVILY_DASHBOARD_URL = "https://app.tavily.com/home";
const TAVILY_DOCS_URL = "https://docs.tavily.com/documentation/api-reference/endpoint/usage";

const TavilySearchParams = Type.Object({
	query: Type.String({ description: "Search query or question" }),
	topic: Type.Optional(StringEnum(["general", "news"] as const, { description: "Search topic: general or news (default: general)" })),
	search_depth: Type.Optional(
		StringEnum(["basic", "advanced"] as const, { description: "Search depth: basic or advanced (default: advanced)" }),
	),
	max_results: Type.Optional(Type.Number({ description: "Number of results to return (default: 5, recommended: 1-10)" })),
	include_answer: Type.Optional(Type.Boolean({ description: "Include Tavily's aggregated answer (default: true)" })),
	include_raw_content: Type.Optional(Type.Boolean({ description: "Include longer raw page content (default: false)" })),
	include_domains: Type.Optional(
		Type.Array(Type.String(), { description: 'Only search these domains, e.g. ["docs.go101.org", "go.dev"]' }),
	),
	exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude these domains" })),
});

const TavilyExtractParams = Type.Object({
	urls: Type.Array(Type.String(), { description: "List of URLs to extract" }),
	extract_depth: Type.Optional(
		StringEnum(["basic", "advanced"] as const, { description: "Extraction depth: basic or advanced (default: advanced)" }),
	),
	include_images: Type.Optional(Type.Boolean({ description: "Include image URLs from the page (default: false)" })),
});

const TavilyCrawlParams = Type.Object({
	url: Type.String({ description: "Starting URL" }),
	instructions: Type.Optional(Type.String({ description: "Crawl focus or instructions, e.g. API docs or installation pages" })),
	max_depth: Type.Optional(Type.Number({ description: "Maximum crawl depth (default: 2)" })),
	max_breadth: Type.Optional(Type.Number({ description: "Maximum breadth per level (default: 20)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of pages to return (default: 10)" })),
	select_paths: Type.Optional(Type.Array(Type.String(), { description: 'Only crawl these path prefixes, e.g. ["/docs", "/api"]' })),
	exclude_paths: Type.Optional(Type.Array(Type.String(), { description: "Exclude these path prefixes" })),
	allow_external: Type.Optional(Type.Boolean({ description: "Allow crawling external domains (default: false)" })),
	extract_depth: Type.Optional(
		StringEnum(["basic", "advanced"] as const, { description: "Page extraction depth: basic or advanced (default: advanced)" }),
	),
	include_images: Type.Optional(Type.Boolean({ description: "Include image URLs in results (default: false)" })),
});

interface TavilyResultItem {
	title?: string;
	url?: string;
	content?: string;
	raw_content?: string;
	score?: number;
	images?: string[];
}

interface TavilyFailedResult {
	url?: string;
	error?: string;
	[index: string]: unknown;
}

interface TavilyResponse {
	answer?: string;
	query?: string;
	response_time?: number;
	results?: TavilyResultItem[];
	failed_results?: TavilyFailedResult[];
	base_url?: string;
}

interface TavilyUsageBreakdown {
	usage?: number;
	limit?: number;
	search_usage?: number;
	extract_usage?: number;
	crawl_usage?: number;
	map_usage?: number;
	research_usage?: number;
	paygo_usage?: number;
	paygo_limit?: number;
	plan_usage?: number;
	plan_limit?: number;
	current_plan?: string;
}

interface TavilyUsageResponse {
	key?: TavilyUsageBreakdown;
	account?: TavilyUsageBreakdown;
}

interface ToolDetails {
	truncated: boolean;
	truncation?: TruncationResult;
	fullOutputPath?: string;
	responseTime?: number;
	resultCount?: number;
	failedCount?: number;
	[key: string]: unknown;
}

interface ApiKeyInfo {
	ok: boolean;
	apiKey?: string;
	source?: string;
	masked?: string;
	message?: string;
}

interface SessionUsageStats {
	totalCalls: number;
	searchCalls: number;
	extractCalls: number;
	crawlCalls: number;
	failedCalls: number;
	truncatedCalls: number;
	totalResults: number;
	totalFailedResults: number;
	averageResponseTimeSec?: number;
	firstUsedAt?: number;
	lastUsedAt?: number;
	recentQueries: string[];
	recentUrls: string[];
}

function getApiKeyInfo(): ApiKeyInfo {
	const envApiKey = process.env.TAVILY_API_KEY?.trim();
	if (envApiKey) {
		return {
			ok: true,
			apiKey: envApiKey,
			source: "Environment variable TAVILY_API_KEY",
			masked: maskApiKey(envApiKey),
		};
	}

	try {
		const fileApiKey = readFileSync(KEY_FILE_PATH, "utf-8").trim();
		if (fileApiKey) {
			return {
				ok: true,
				apiKey: fileApiKey,
				source: KEY_FILE_PATH,
				masked: maskApiKey(fileApiKey),
			};
		}
	} catch {
		// ignore
	}

	return {
		ok: false,
		message:
			"Tavily API key not found. Set TAVILY_API_KEY or write the key to ~/.pi/agent/tavily.key, then run /reload in pi.",
	};
}

function getApiKey(): string {
	const info = getApiKeyInfo();
	if (info.ok && info.apiKey) {
		return info.apiKey;
	}
	throw new Error(info.message || "Tavily API key not found");
}

function maskApiKey(apiKey: string): string {
	if (apiKey.length <= 12) {
		return `${apiKey.slice(0, 4)}****`;
	}
	return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

function normalizeTopic(topic?: string): "general" | "news" {
	return topic === "news" ? "news" : "general";
}

function normalizeSearchDepth(depth?: string): "basic" | "advanced" {
	return depth === "basic" ? "basic" : "advanced";
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.floor(value), min), max);
}

function compactText(text: string | undefined): string {
	return text?.replace(/\s+/g, " ").trim() ?? "";
}

function shorten(text: string | undefined, max = 500): string {
	const normalized = compactText(text);
	if (!normalized) return "";
	if (normalized.length <= max) return normalized;
	return `${normalized.slice(0, max - 1)}…`;
}

function cleanStringArray(values: string[] | undefined, maxItems: number): string[] | undefined {
	if (!values?.length) return undefined;

	const deduped = Array.from(
		new Set(
			values
				.map((item) => item.trim())
				.filter(Boolean),
		),
	).slice(0, maxItems);

	return deduped.length > 0 ? deduped : undefined;
}

function normalizeUrls(urls: string[]): string[] {
	const cleaned = cleanStringArray(urls, MAX_URLS_PER_EXTRACT) ?? [];
	if (cleaned.length === 0) {
		throw new Error("urls cannot be empty");
	}

	for (const url of cleaned) {
		try {
			new URL(url);
		} catch {
			throw new Error(`Invalid URL: ${url}`);
		}
	}

	return cleaned;
}

function normalizeUrl(url: string, fieldName: string): string {
	const value = url.trim();
	if (!value) {
		throw new Error(`${fieldName} cannot be empty`);
	}

	try {
		return new URL(value).toString();
	} catch {
		throw new Error(`${fieldName} is not a valid URL: ${url}`);
	}
}

function saveFullOutput(name: string, output: string): string {
	const tempDir = mkdtempSync(join(tmpdir(), "pi-tavily-"));
	const filePath = join(tempDir, `${name}.txt`);
	writeFileSync(filePath, output, "utf-8");
	return filePath;
}

function truncateForModel(
	name: string,
	text: string,
): { text: string; truncated: boolean; truncation?: TruncationResult; fullOutputPath?: string } {
	const truncation = truncateHead(text, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	if (!truncation.truncated) {
		return { text: truncation.content, truncated: false };
	}

	const fullOutputPath = saveFullOutput(name, text);
	let result = truncation.content;
	result += `\n\n[Output truncated: showing ${truncation.outputLines}/${truncation.totalLines} lines, `;
	result += `${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}.`;
	result += ` Full output saved to: ${fullOutputPath}]`;

	return {
		text: result,
		truncated: true,
		truncation,
		fullOutputPath,
	};
}

function makeRequestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function postTavily(path: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<TavilyResponse> {
	const requestSignal = makeRequestSignal(signal, REQUEST_TIMEOUT_MS);
	let response: Response;

	try {
		response = await fetch(`https://api.tavily.com/${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: getApiKey(),
				...payload,
			}),
			signal: requestSignal,
		});
	} catch (error) {
		if (requestSignal.aborted) {
			throw new Error(`Tavily ${path} request was cancelled or timed out (> ${REQUEST_TIMEOUT_MS}ms)`);
		}
		throw new Error(`Tavily ${path} request failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	const rawText = await response.text();
	let data: TavilyResponse | undefined;
	if (rawText.trim()) {
		try {
			data = JSON.parse(rawText) as TavilyResponse;
		} catch {
			if (!response.ok) {
				throw new Error(`Tavily ${path} request failed (${response.status}): ${rawText}`);
			}
			throw new Error(`Tavily ${path} returned an unparseable response: ${rawText}`);
		}
	}

	if (!response.ok) {
		const record = data as Record<string, unknown> | undefined;
		const errorMessage = record?.detail ?? record?.error ?? (rawText || response.statusText);
		throw new Error(`Tavily ${path} request failed (${response.status}): ${String(errorMessage)}`);
	}

	return data ?? {};
}

async function getTavilyUsage(signal?: AbortSignal): Promise<TavilyUsageResponse> {
	const requestSignal = makeRequestSignal(signal, USAGE_REQUEST_TIMEOUT_MS);
	let response: Response;

	try {
		response = await fetch("https://api.tavily.com/usage", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${getApiKey()}`,
			},
			signal: requestSignal,
		});
	} catch (error) {
		if (requestSignal.aborted) {
			throw new Error(`Tavily usage request was cancelled or timed out (> ${USAGE_REQUEST_TIMEOUT_MS}ms)`);
		}
		throw new Error(`Tavily usage request failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	const rawText = await response.text();
	let data: TavilyUsageResponse | undefined;
	if (rawText.trim()) {
		try {
			data = JSON.parse(rawText) as TavilyUsageResponse;
		} catch {
			throw new Error(`Tavily usage returned an unparseable response: ${rawText}`);
		}
	}

	if (!response.ok) {
		const record = data as Record<string, unknown> | undefined;
		const errorMessage = record?.detail ?? record?.error ?? (rawText || response.statusText);
		throw new Error(`Tavily usage request failed (${response.status}): ${String(errorMessage)}`);
	}

	return data ?? {};
}

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

function formatSearchResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (data.query) {
		lines.push(`Query: ${data.query}`);
	}
	if (typeof data.response_time === "number") {
		lines.push(`Response Time: ${data.response_time}s`);
	}
	if (lines.length > 0) {
		lines.push("");
	}

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

function formatExtractResults(data: TavilyResponse): string {
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

function formatCrawlResults(data: TavilyResponse): string {
	const lines: string[] = [];

	if (data.base_url) {
		lines.push(`Base URL: ${data.base_url}`);
	}
	if (typeof data.response_time === "number") {
		lines.push(`Response Time: ${data.response_time}s`);
	}
	if (lines.length > 0) {
		lines.push("");
	}

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

function extractSessionUsageStats(ctx: any): SessionUsageStats {
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

		if (message.isError) {
			stats.failedCalls += 1;
		}

		const details = (message.details ?? {}) as Record<string, unknown>;
		if (details.truncated === true) stats.truncatedCalls += 1;
		stats.totalResults += toNumber(details.resultCount) ?? 0;
		stats.totalFailedResults += toNumber(details.failedCount) ?? 0;

		const responseTime = toNumber(details.responseTime);
		if (responseTime !== undefined) {
			responseTimes.push(responseTime);
		}

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

function getApiKeyGuidance(): string {
	return [
		"Tavily API key not found.",
		"",
		"Setup:",
		`1. Create an API key in the Tavily dashboard: ${TAVILY_DASHBOARD_URL}`,
		"2. Configure one of the following:",
		"   - Temporary env var: export TAVILY_API_KEY='tvly-xxxxx'",
		`   - Key file: mkdir -p ~/.pi/agent && printf '%s' 'tvly-xxxxx' > ${KEY_FILE_PATH}`,
		"3. Run /reload in pi",
		"4. Run /tavily:status again",
		"",
		`Docs: ${TAVILY_DOCS_URL}`,
	].join("\n");
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

function buildStatusPanelLines(details: {
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
		if (expanded && details.guidance) {
			lines.push("", theme.fg("dim", details.guidance));
		}
	} else {
		lines.push("", theme.bold("Usage"));
		lines.push(
			`${theme.fg("accent", "Key ")} ${colorForPercent(theme, keyPercent, renderBar(keyPercent, expanded ? 24 : 18))} ${theme.fg("muted", formatUsageSummary(keyUsage))}`,
		);
		lines.push(
			`${theme.fg("accent", "Acct")} ${colorForPercent(theme, accountPercent, renderBar(accountPercent, expanded ? 24 : 18))} ${theme.fg("muted", formatUsageSummary(accountUsage))}`,
		);
		if (expanded && keyUsage) {
			const parts = formatBreakdownParts(keyUsage);
			if (parts.length > 0) lines.push(`${theme.fg("dim", `key: ${parts.join("  ")}`)}`);
		}
		if (expanded && accountUsage) {
			const plan = accountUsage.current_plan ? `plan=${accountUsage.current_plan}  ` : "";
			const parts = formatBreakdownParts(accountUsage);
			lines.push(`${theme.fg("dim", `${plan}${parts.join("  ")}`.trim())}`);
		}
		if (details.usageError) {
			lines.push("", `${theme.fg("warning", "Usage error:")} ${theme.fg("muted", details.usageError)}`);
		}
	}

	lines.push("", theme.bold("Session"));
	lines.push(
		`${theme.fg("accent", "Calls")} ${theme.bold(String(sessionStats.totalCalls))}  ${theme.fg("muted", `s=${sessionStats.searchCalls}  e=${sessionStats.extractCalls}  c=${sessionStats.crawlCalls}`)}`,
	);
	lines.push(
		`${theme.fg("accent", "Stats")} ${theme.bold(String(sessionStats.totalResults))} ${theme.fg("muted", "results")}  ${theme.fg("muted", `failed=${sessionStats.failedCalls}  trunc=${sessionStats.truncatedCalls}  avg=${sessionStats.averageResponseTimeSec ? `${sessionStats.averageResponseTimeSec.toFixed(2)}s` : "-"}`)}`,
	);

	if (expanded) {
		lines.push(theme.fg("dim", `first=${formatTimestamp(sessionStats.firstUsedAt)}  last=${formatTimestamp(sessionStats.lastUsedAt)}`));
	}

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

async function showStatusPanel(ctx: any, details: {
	configured: boolean;
	apiKeySource?: string;
	apiKeyMasked?: string;
	usage?: TavilyUsageResponse;
	usageError?: string;
	sessionStats: SessionUsageStats;
	guidance?: string;
}): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify(
			details.configured ? "Tavily is ready. Run /tavily:status in interactive UI to view the panel." : "Tavily API key not configured",
			details.configured ? "info" : "warning",
		);
		return;
	}

	await ctx.ui.custom<void>((tui, theme, _kb, done) => {
		let expanded = false;
		let cached: string[] | undefined;

		return {
			render(width: number) {
				if (cached) return cached;
				const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
				box.addChild(new Text(buildStatusPanelLines(details, theme, expanded).join("\n"), 0, 0));
				cached = box.render(width);
				return cached;
			},
			invalidate() {
				cached = undefined;
			},
			handleInput(data: string) {
				if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || data === "q") {
					done();
					return;
				}
				if (data === "e") {
					expanded = !expanded;
					cached = undefined;
					tui.requestRender();
				}
			},
		};
	}, {
		overlay: true,
		overlayOptions: {
			width: "46%",
			minWidth: 56,
			maxWidth: 80,
			maxHeight: "85%",
			anchor: "center",
			margin: 3,
		},
	});
}

async function showStatus(_pi: ExtensionAPI, ctx: any): Promise<void> {
	const apiKeyInfo = getApiKeyInfo();
	const sessionStats = extractSessionUsageStats(ctx);

	if (!apiKeyInfo.ok || !apiKeyInfo.apiKey) {
		await showStatusPanel(ctx, {
			configured: false,
			sessionStats,
			guidance: getApiKeyGuidance(),
		});
		return;
	}

	let usage: TavilyUsageResponse | undefined;
	let usageError: string | undefined;
	try {
		usage = await getTavilyUsage();
	} catch (error) {
		usageError = error instanceof Error ? error.message : String(error);
	}

	await showStatusPanel(ctx, {
		configured: true,
		apiKeySource: apiKeyInfo.source,
		apiKeyMasked: apiKeyInfo.masked,
		usage,
		usageError,
		sessionStats,
	});
}

export default function tavilySearchExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "tavily_search",
		label: "Tavily Search",
		description: `Search the web with Tavily for current information, official docs, web pages, and news. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; when truncated, the full output is saved to a temp file.`,
		promptSnippet: "Search the web using Tavily for up-to-date information and relevant web pages",
		promptGuidelines: [
			"Use this tool when the user explicitly asks for web search, latest information, official websites, or news.",
			"Use read/bash/grep/find for local repository search instead of Tavily.",
		],
		parameters: TavilySearchParams,

		async execute(_toolCallId, params, signal) {
			const query = compactText(params.query);
			if (!query) {
				throw new Error("query cannot be empty");
			}

			const payload = {
				query,
				topic: normalizeTopic(params.topic),
				search_depth: normalizeSearchDepth(params.search_depth),
				max_results: clamp(params.max_results ?? 5, 1, 10),
				include_answer: params.include_answer ?? true,
				include_raw_content: params.include_raw_content ?? false,
				include_domains: cleanStringArray(params.include_domains, MAX_DOMAINS),
				exclude_domains: cleanStringArray(params.exclude_domains, MAX_DOMAINS),
			};

			const data = await postTavily("search", payload, signal);
			const truncated = truncateForModel("search", formatSearchResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: {
					query,
					topic: payload.topic,
					searchDepth: payload.search_depth,
					maxResults: payload.max_results,
					includeAnswer: payload.include_answer,
					includeRawContent: payload.include_raw_content,
					includeDomains: payload.include_domains,
					excludeDomains: payload.exclude_domains,
					responseTime: data.response_time,
					resultCount: data.results?.length ?? 0,
					failedCount: data.failed_results?.length ?? 0,
					truncated: truncated.truncated,
					truncation: truncated.truncation,
					fullOutputPath: truncated.fullOutputPath,
				} satisfies ToolDetails,
			};
		},
	});

	pi.registerTool({
		name: "tavily_extract",
		label: "Tavily Extract",
		description: `Extract the main content of one or more web pages with Tavily. Useful for reading docs, blog posts, and announcements. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; when truncated, the full output is saved to a temp file.`,
		promptSnippet: "Extract the main content of one or more web pages using Tavily",
		promptGuidelines: ["Use this tool when you already know the target URL and need the page content."],
		parameters: TavilyExtractParams,

		async execute(_toolCallId, params, signal) {
			const urls = normalizeUrls(params.urls);
			const payload = {
				urls,
				extract_depth: normalizeSearchDepth(params.extract_depth),
				include_images: params.include_images ?? false,
			};

			const data = await postTavily("extract", payload, signal);
			const truncated = truncateForModel("extract", formatExtractResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: {
					urls,
					urlCount: urls.length,
					extractDepth: payload.extract_depth,
					includeImages: payload.include_images,
					responseTime: data.response_time,
					resultCount: data.results?.length ?? 0,
					failedCount: data.failed_results?.length ?? 0,
					truncated: truncated.truncated,
					truncation: truncated.truncation,
					fullOutputPath: truncated.fullOutputPath,
				} satisfies ToolDetails,
			};
		},
	});

	pi.registerTool({
		name: "tavily_crawl",
		label: "Tavily Crawl",
		description: `Crawl related pages from a starting URL with Tavily. Useful for exploring documentation sites, knowledge bases, and blog directories in bulk. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; when truncated, the full output is saved to a temp file.`,
		promptSnippet: "Crawl related pages from a starting URL using Tavily",
		promptGuidelines: ["Use this tool when the user wants to explore pages around a site, docs section, or entry URL."],
		parameters: TavilyCrawlParams,

		async execute(_toolCallId, params, signal) {
			const url = normalizeUrl(params.url, "url");
			const payload = {
				url,
				instructions: compactText(params.instructions) || undefined,
				max_depth: clamp(params.max_depth ?? 2, 1, 5),
				max_breadth: clamp(params.max_breadth ?? 20, 1, 50),
				limit: clamp(params.limit ?? 10, 1, 50),
				select_paths: cleanStringArray(params.select_paths, 50),
				exclude_paths: cleanStringArray(params.exclude_paths, 50),
				allow_external: params.allow_external ?? false,
				extract_depth: normalizeSearchDepth(params.extract_depth),
				include_images: params.include_images ?? false,
			};

			const data = await postTavily("crawl", payload, signal);
			const truncated = truncateForModel("crawl", formatCrawlResults(data));

			return {
				content: [{ type: "text", text: truncated.text }],
				details: {
					url,
					instructions: payload.instructions,
					maxDepth: payload.max_depth,
					maxBreadth: payload.max_breadth,
					limit: payload.limit,
					selectPaths: payload.select_paths,
					excludePaths: payload.exclude_paths,
					allowExternal: payload.allow_external,
					extractDepth: payload.extract_depth,
					includeImages: payload.include_images,
					responseTime: data.response_time,
					resultCount: data.results?.length ?? 0,
					failedCount: data.failed_results?.length ?? 0,
					truncated: truncated.truncated,
					truncation: truncated.truncation,
					fullOutputPath: truncated.fullOutputPath,
				} satisfies ToolDetails,
			};
		},
	});

	pi.registerCommand("tavily:status", {
		description: "Show Tavily config status, usage info, and current session stats",
		handler: async (_args, ctx) => {
			await showStatus(pi, ctx);
		},
	});
}
