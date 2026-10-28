import { Type } from "@earendil-works/pi-ai";
import type { TavilyResponse } from "./types.js";

/**
 * JSON schema for the machine-readable Tavily result returned as
 * `structuredContent`. Text content remains the model-facing result; codemode
 * scripts and other tools receive this shape instead.
 */
export const TavilyOutputSchema = Type.Object({
	query: Type.Optional(Type.String()),
	answer: Type.Optional(Type.String()),
	responseTime: Type.Optional(Type.Number()),
	results: Type.Array(
		Type.Object({
			title: Type.Optional(Type.String()),
			url: Type.Optional(Type.String()),
			content: Type.Optional(Type.String()),
			rawContent: Type.Optional(Type.String()),
			score: Type.Optional(Type.Number()),
			images: Type.Optional(Type.Array(Type.String())),
		}),
	),
	failedResults: Type.Array(
		Type.Object({
			url: Type.Optional(Type.String()),
			error: Type.Optional(Type.String()),
		}),
	),
});

export type TavilyStructuredResult = {
	query?: string;
	answer?: string;
	responseTime?: number;
	results: Array<{
		title?: string;
		url?: string;
		content?: string;
		rawContent?: string;
		score?: number;
		images?: string[];
	}>;
	failedResults: Array<{
		url?: string;
		error?: string;
	}>;
};

/** Convert a Tavily API response into the compact structured shape. */
export function buildStructuredContent(data: TavilyResponse): TavilyStructuredResult {
	const result: TavilyStructuredResult = {
		results: (data.results ?? []).map((item) => ({
			...(item.title !== undefined ? { title: item.title } : {}),
			...(item.url !== undefined ? { url: item.url } : {}),
			...(item.content !== undefined ? { content: item.content } : {}),
			...(item.raw_content !== undefined ? { rawContent: item.raw_content } : {}),
			...(typeof item.score === "number" ? { score: item.score } : {}),
			...(item.images?.length ? { images: item.images } : {}),
		})),
		failedResults: (data.failed_results ?? []).map((item) => ({
			...(item.url !== undefined ? { url: item.url } : {}),
			...(item.error !== undefined ? { error: item.error } : {}),
		})),
	};

	if (data.query !== undefined) result.query = data.query;
	if (data.answer !== undefined) result.answer = data.answer;
	if (typeof data.response_time === "number") result.responseTime = data.response_time;

	return result;
}
