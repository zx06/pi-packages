import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	type TruncationResult,
} from "@mariozechner/pi-coding-agent";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { TEMP_DIR_PREFIX, KEY_FILE_PATH, MAX_URLS_PER_EXTRACT, TAVILY_DASHBOARD_URL, TAVILY_DOCS_URL } from "./constants.js";
import type { ApiKeyInfo, TruncatedOutput } from "./types.js";

export function getApiKeyInfo(): ApiKeyInfo {
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
		message: "Tavily API key not found. Set TAVILY_API_KEY or write the key to ~/.pi/agent/tavily.key, then run /reload in pi.",
	};
}

export function getApiKey(): string {
	const info = getApiKeyInfo();
	if (info.ok && info.apiKey) {
		return info.apiKey;
	}
	throw new Error(info.message || "Tavily API key not found");
}

export function maskApiKey(apiKey: string): string {
	if (apiKey.length <= 12) {
		return `${apiKey.slice(0, 4)}****`;
	}
	return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

export function normalizeTopic(topic?: string): "general" | "news" {
	return topic === "news" ? "news" : "general";
}

export function normalizeSearchDepth(depth?: string): "basic" | "advanced" {
	return depth === "basic" ? "basic" : "advanced";
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.floor(value), min), max);
}

export function compactText(text: string | undefined): string {
	return text?.replace(/\s+/g, " ").trim() ?? "";
}

export function shorten(text: string | undefined, max = 500): string {
	const normalized = compactText(text);
	if (!normalized) return "";
	if (normalized.length <= max) return normalized;
	return `${normalized.slice(0, max - 1)}…`;
}

export function cleanStringArray(values: string[] | undefined, maxItems: number): string[] | undefined {
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

export function normalizeUrls(urls: string[]): string[] {
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

export function normalizeUrl(url: string, fieldName: string): string {
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
	const tempDir = mkdtempSync(TEMP_DIR_PREFIX);
	const filePath = `${tempDir}/${name}.txt`;
	writeFileSync(filePath, output, "utf-8");
	return filePath;
}

export function truncateForModel(
	name: string,
	text: string,
): TruncatedOutput {
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

export function getApiKeyGuidance(): string {
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
