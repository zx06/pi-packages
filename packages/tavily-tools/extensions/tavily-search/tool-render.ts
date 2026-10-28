import type { Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { ToolDetails } from "./types.js";

export type TavilyToolKind = "search" | "extract" | "crawl";

type RenderOptions = Parameters<NonNullable<ToolDefinition["renderResult"]>>[1];
type RenderContext = Parameters<NonNullable<ToolDefinition["renderResult"]>>[3];
type ToolResult = Parameters<NonNullable<ToolDefinition["renderResult"]>>[0];

type TavilyArgs = {
	query?: string;
	urls?: string[];
	url?: string;
	topic?: string;
	search_depth?: string;
	extract_depth?: string;
	max_results?: number;
	max_depth?: number;
	max_breadth?: number;
	limit?: number;
	instructions?: string;
};

const MAX_EXPANDED_LINES = 12;
const MAX_LINE_WIDTH = 120;

function truncateLine(line: string): string {
	const trimmed = line.trimEnd();
	return trimmed.length > MAX_LINE_WIDTH ? `${trimmed.slice(0, MAX_LINE_WIDTH - 1)}…` : trimmed;
}

function resultText(result: ToolResult): string {
	const text = result.content.find((item) => item.type === "text");
	return text?.type === "text" ? text.text : "";
}

function joinParts(parts: string[], theme: Theme): string {
	return parts.join(theme.fg("dim", " · "));
}

export function renderTavilyCall(
	kind: TavilyToolKind,
	args: TavilyArgs,
	theme: Theme,
	context: RenderContext,
) {
	const title = theme.fg("toolTitle", theme.bold(`tavily_${kind}`));
	const dim = (text: string) => theme.fg("dim", text);
	const accent = (text: string) => theme.fg("accent", text);

	let text = title;

	if (kind === "search") {
		text += ` ${accent(args.query ?? "")}`;
		const meta = [
			args.topic ? dim(`topic=${args.topic}`) : "",
			args.search_depth ? dim(`depth=${args.search_depth}`) : "",
			typeof args.max_results === "number" ? dim(`max=${args.max_results}`) : "",
		].filter(Boolean);
		if (meta.length > 0) text += ` ${joinParts(meta, theme)}`;
	} else if (kind === "extract") {
		const count = args.urls?.length ?? 0;
		text += ` ${accent(`${count} page${count === 1 ? "" : "s"}`)}`;
		if (args.extract_depth) text += ` ${dim(`depth=${args.extract_depth}`)}`;
		if (context.expanded && args.urls?.length) {
			for (const url of args.urls.slice(0, 8)) text += `\n${dim(`  ${url}`)}`;
			if (args.urls.length > 8) text += `\n${dim(`  … ${args.urls.length - 8} more`)}`;
		}
	} else {
		text += ` ${accent(args.url ?? "")}`;
		const meta = [
			typeof args.max_depth === "number" ? dim(`depth=${args.max_depth}`) : "",
			typeof args.max_breadth === "number" ? dim(`breadth=${args.max_breadth}`) : "",
			typeof args.limit === "number" ? dim(`limit=${args.limit}`) : "",
		].filter(Boolean);
		if (meta.length > 0) text += ` ${joinParts(meta, theme)}`;
		if (context.expanded && args.instructions) {
			text += `\n${dim(`  ${truncateLine(args.instructions)}`)}`;
		}
	}

	return new Text(text, 0, 0);
}

export function renderTavilyResult(
	kind: TavilyToolKind,
	result: ToolResult,
	options: RenderOptions,
	theme: Theme,
	context: RenderContext,
) {
	const dim = (text: string) => theme.fg("dim", text);
	const accent = (text: string) => theme.fg("accent", text);

	if (options.isPartial) {
		const verb = kind === "search" ? "Searching" : kind === "extract" ? "Extracting" : "Crawling";
		return new Text(theme.fg("warning", `${verb}…`), 0, 0);
	}

	const text = resultText(result);
	const details = (result.details ?? {}) as ToolDetails;

	if (context.isError || result.isError) {
		const firstLine = text.split("\n").find((line) => line.trim());
		return new Text(theme.fg("error", truncateLine(firstLine ?? "Tavily request failed")), 0, 0);
	}

	const count = details.resultCount ?? 0;
	const noun = kind === "search" ? "result" : "page";
	const parts = [theme.fg("success", `✓ ${count} ${noun}${count === 1 ? "" : "s"}`)];

	if (details.failedCount) {
		parts.push(theme.fg("warning", `${details.failedCount} failed`));
	}

	const seconds =
		typeof details.responseTime === "number"
			? details.responseTime
			: context.durationMs !== undefined
				? context.durationMs / 1000
				: undefined;
	if (seconds !== undefined) parts.push(dim(`${seconds.toFixed(2)}s`));
	if (details.truncated) parts.push(theme.fg("warning", "truncated"));

	let output = joinParts(parts, theme);

	if (options.expanded) {
		const lines = text
			.split("\n")
			.map((line) => line.trimEnd())
			.filter((line) => line.length > 0)
			.slice(0, MAX_EXPANDED_LINES);
		for (const line of lines) output += `\n${dim(truncateLine(line))}`;

		if (details.fullOutputPath) {
			output += `\n${dim("full output: ")}${accent(details.fullOutputPath)}`;
		}
	}

	return new Text(output, 0, 0);
}
