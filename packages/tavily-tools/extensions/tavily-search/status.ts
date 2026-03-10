import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Key, Text, matchesKey } from "@mariozechner/pi-tui";
import { getTavilyUsage } from "./api.js";
import { buildStatusPanelLines, extractSessionUsageStats } from "./formatters.js";
import type { TavilyUsageResponse } from "./types.js";
import { getApiKeyGuidance, getApiKeyInfo } from "./utils.js";

async function showStatusPanel(ctx: any, details: {
	configured: boolean;
	apiKeySource?: string;
	apiKeyMasked?: string;
	usage?: TavilyUsageResponse;
	usageError?: string;
	sessionStats: ReturnType<typeof extractSessionUsageStats>;
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

export async function showStatus(_pi: ExtensionAPI, ctx: any): Promise<void> {
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
