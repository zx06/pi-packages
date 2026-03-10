import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

export const TavilySearchParams = Type.Object({
	query: Type.String({ description: "Search query or question" }),
	topic: Type.Optional(StringEnum(["general", "news"] as const, { description: "Search topic: general or news (default: general)" })),
	search_depth: Type.Optional(
		StringEnum(["basic", "advanced"] as const, { description: "Search depth: basic or advanced (default: advanced)" }),
	),
	max_results: Type.Optional(Type.Number({ description: "Number of results to return (default: 5, recommended: 1-10)" })),
	include_answer: Type.Optional(Type.Boolean({ description: "Include Tavily's aggregated answer (default: true)" })),
	include_raw_content: Type.Optional(Type.Boolean({ description: "Include longer raw page content (default: false)" })),
	include_domains: Type.Optional(Type.Array(Type.String(), { description: 'Only search these domains, e.g. ["docs.go101.org", "go.dev"]' })),
	exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude these domains" })),
});

export const TavilyExtractParams = Type.Object({
	urls: Type.Array(Type.String(), { description: "List of URLs to extract" }),
	extract_depth: Type.Optional(
		StringEnum(["basic", "advanced"] as const, { description: "Extraction depth: basic or advanced (default: advanced)" }),
	),
	include_images: Type.Optional(Type.Boolean({ description: "Include image URLs from the page (default: false)" })),
});

export const TavilyCrawlParams = Type.Object({
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
