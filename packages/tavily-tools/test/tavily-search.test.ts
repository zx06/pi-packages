import test from "node:test";
import assert from "node:assert/strict";
import { buildCrawlPayload, buildExtractPayload, buildSearchPayload } from "../extensions/tavily-search/build-payloads.ts";
import { buildStatusPanelLines, formatSearchResults } from "../extensions/tavily-search/formatters.ts";

test("buildSearchPayload normalizes and clamps fields", () => {
	const payload = buildSearchPayload({
		query: "  latest   tavily   docs ",
		topic: "invalid",
		search_depth: "basic",
		max_results: 99,
		include_domains: ["go.dev", " go.dev ", ""],
	});

	assert.equal(payload.query, "latest tavily docs");
	assert.equal(payload.topic, "general");
	assert.equal(payload.search_depth, "basic");
	assert.equal(payload.max_results, 10);
	assert.deepEqual(payload.include_domains, ["go.dev"]);
	assert.equal(payload.include_answer, true);
	assert.equal(payload.include_raw_content, false);
});

test("buildExtractPayload validates and deduplicates urls", () => {
	const payload = buildExtractPayload({
		urls: ["https://example.com", " https://example.com ", "https://example.org/docs"],
	});

	assert.deepEqual(payload.urls, ["https://example.com", "https://example.org/docs"]);
	assert.equal(payload.extract_depth, "advanced");
	assert.equal(payload.include_images, false);
});

test("buildCrawlPayload normalizes ranges and optional fields", () => {
	const payload = buildCrawlPayload({
		url: "https://example.com/docs",
		instructions: "  api   docs  only ",
		max_depth: 99,
		max_breadth: 0,
		limit: 100,
		select_paths: ["/docs", "/docs", ""],
	});

	assert.equal(payload.url, "https://example.com/docs");
	assert.equal(payload.instructions, "api docs only");
	assert.equal(payload.max_depth, 5);
	assert.equal(payload.max_breadth, 1);
	assert.equal(payload.limit, 50);
	assert.deepEqual(payload.select_paths, ["/docs"]);
	assert.equal(payload.allow_external, false);
});

test("formatSearchResults renders answer and results", () => {
	const text = formatSearchResults({
		query: "tavily api",
		answer: "summary",
		response_time: 0.42,
		results: [{ title: "Tavily", url: "https://tavily.com", content: "Search api" }],
	});

	assert.match(text, /Query: tavily api/);
	assert.match(text, /Answer:/);
	assert.match(text, /1\. Tavily/);
	assert.match(text, /URL: https:\/\/tavily.com/);
});

test("buildStatusPanelLines shows configured status and notes", () => {
	const theme = {
		fg: (_token: string, text: string) => text,
		bold: (text: string) => text,
	};

	const lines = buildStatusPanelLines({
		configured: true,
		apiKeyMasked: "tvly-1234",
		sessionStats: {
			totalCalls: 2,
			searchCalls: 1,
			extractCalls: 1,
			crawlCalls: 0,
			failedCalls: 0,
			truncatedCalls: 0,
			totalResults: 3,
			totalFailedResults: 0,
			recentQueries: ["tavily"],
			recentUrls: ["https://example.com"],
		},
		usage: {
			key: { usage: 10, limit: 100 },
			account: { usage: 20, limit: 100, current_plan: "free" },
		},
	}, theme, true);

	assert.ok(lines.some((line) => line.includes("Tavily Status")));
	assert.ok(lines.some((line) => line.includes("Recent queries")));
	assert.ok(lines.some((line) => line.includes("Usage docs:")));
});
