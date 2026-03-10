import type { TruncationResult } from "@mariozechner/pi-coding-agent";

export interface TavilyResultItem {
	title?: string;
	url?: string;
	content?: string;
	raw_content?: string;
	score?: number;
	images?: string[];
}

export interface TavilyFailedResult {
	url?: string;
	error?: string;
	[index: string]: unknown;
}

export interface TavilyResponse {
	answer?: string;
	query?: string;
	response_time?: number;
	results?: TavilyResultItem[];
	failed_results?: TavilyFailedResult[];
	base_url?: string;
}

export interface TavilyUsageBreakdown {
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

export interface TavilyUsageResponse {
	key?: TavilyUsageBreakdown;
	account?: TavilyUsageBreakdown;
}

export interface TruncatedOutput {
	text: string;
	truncated: boolean;
	truncation?: TruncationResult;
	fullOutputPath?: string;
}

export interface ToolDetails {
	truncated: boolean;
	truncation?: TruncationResult;
	fullOutputPath?: string;
	responseTime?: number;
	resultCount?: number;
	failedCount?: number;
	[key: string]: unknown;
}

export interface ApiKeyInfo {
	ok: boolean;
	apiKey?: string;
	source?: string;
	masked?: string;
	message?: string;
}

export interface SessionUsageStats {
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
