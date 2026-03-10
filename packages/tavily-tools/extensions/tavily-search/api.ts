import { REQUEST_TIMEOUT_MS, USAGE_REQUEST_TIMEOUT_MS } from "./constants.js";
import type { TavilyResponse, TavilyUsageResponse } from "./types.js";
import { getApiKey } from "./utils.js";

function makeRequestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

export async function postTavily(path: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<TavilyResponse> {
	const requestSignal = makeRequestSignal(signal, REQUEST_TIMEOUT_MS);
	const apiKey = getApiKey();
	let response: Response;

	try {
		response = await fetch(`https://api.tavily.com/${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
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

export async function getTavilyUsage(signal?: AbortSignal): Promise<TavilyUsageResponse> {
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
