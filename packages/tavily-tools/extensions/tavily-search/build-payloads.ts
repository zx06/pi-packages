import { MAX_DOMAINS } from "./constants.js";
import {
	clamp,
	cleanStringArray,
	compactText,
	normalizeSearchDepth,
	normalizeTopic,
	normalizeUrl,
	normalizeUrls,
} from "./utils.js";

export function buildSearchPayload(params: {
	query: string;
	topic?: string;
	search_depth?: string;
	max_results?: number;
	include_answer?: boolean;
	include_raw_content?: boolean;
	include_domains?: string[];
	exclude_domains?: string[];
}) {
	const query = compactText(params.query);
	if (!query) throw new Error("query cannot be empty");

	return {
		query,
		topic: normalizeTopic(params.topic),
		search_depth: normalizeSearchDepth(params.search_depth),
		max_results: clamp(params.max_results ?? 5, 1, 10),
		include_answer: params.include_answer ?? true,
		include_raw_content: params.include_raw_content ?? false,
		include_domains: cleanStringArray(params.include_domains, MAX_DOMAINS),
		exclude_domains: cleanStringArray(params.exclude_domains, MAX_DOMAINS),
	};
}

export function buildExtractPayload(params: {
	urls: string[];
	extract_depth?: string;
	include_images?: boolean;
}) {
	return {
		urls: normalizeUrls(params.urls),
		extract_depth: normalizeSearchDepth(params.extract_depth),
		include_images: params.include_images ?? false,
	};
}

export function buildCrawlPayload(params: {
	url: string;
	instructions?: string;
	max_depth?: number;
	max_breadth?: number;
	limit?: number;
	select_paths?: string[];
	exclude_paths?: string[];
	allow_external?: boolean;
	extract_depth?: string;
	include_images?: boolean;
}) {
	return {
		url: normalizeUrl(params.url, "url"),
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
}
