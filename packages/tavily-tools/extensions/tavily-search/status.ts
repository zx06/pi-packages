import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Key, Text, matchesKey } from "@mariozechner/pi-tui";
import { getTavilyUsage } from "./api.js";
import { buildStatusPanelLines, extractSessionUsageStats } from "./formatters.js";
import type { TavilyUsageResponse } from "./types.js";
import { getApiKeyGuidance, getApiKeyInfo } from "./utils.js";

async function showStatusPanel(
	ctx: any,
	state: {
		configured: boolean;
		apiKeySource?: string;
		apiKeyMasked?: string;
		usageLoading: boolean;
		usage?: TavilyUsageResponse;
		usageError?: string;
		sessionStats: ReturnType<typeof extractSessionUsageStats>;
		guidance?: string;
	},
	tuiRef: { requestRender(): void; invalidate(): void } | null,
): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify(
			state.configured ? "Tavily is ready. Run /tavily:status in interactive UI to view the panel." : "Tavily API key not configured",
			state.configured ? "info" : "warning",
		);
		return;
	}

	await ctx.ui.custom<void>((tui, theme, _kb, done) => {
		// Capture tui so background usage fetch can trigger re-render
		if (tuiRef) {
			tuiRef.requestRender = () => tui.requestRender();
			tuiRef.invalidate = () => { cached = undefined; };
		}

		let expanded = false;
		let cached: string[] | undefined;

		return {
			render(width: number) {
				if (cached) return cached;
				const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
				box.addChild(new Text(buildStatusPanelLines(state, theme, expanded).join("\n"), 0, 0));
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
	// Wait for agent to finish current work so we can render the UI
	await ctx.waitForIdle();
	const apiKeyInfo = getApiKeyInfo();
	const sessionStats = extractSessionUsageStats(ctx);

	if (!apiKeyInfo.ok || !apiKeyInfo.apiKey) {
		await showStatusPanel(ctx, {
			configured: false,
			usageLoading: false,
			sessionStats,
			guidance: getApiKeyGuidance(),
		});
		return;
	}

	// Show panel immediately with local data; usage loads in background
	const state: {
		configured: boolean;
		apiKeySource?: string;
		apiKeyMasked?: string;
		usageLoading: boolean;
		usage?: TavilyUsageResponse;
		usageError?: string;
		sessionStats: ReturnType<typeof extractSessionUsageStats>;
	} = {
		configured: true,
		apiKeySource: apiKeyInfo.source,
		apiKeyMasked: apiKeyInfo.masked,
		usageLoading: true,
		sessionStats,
	};

	// Fire usage fetch in background — don't block panel rendering
	const tuiRef = { requestRender: () => {}, invalidate: () => {} };

	getTavilyUsage()
		.then((usage) => {
			state.usage = usage;
			state.usageLoading = false;
			tuiRef.invalidate();
			tuiRef.requestRender();
		})
		.catch((error) => {
			state.usageError = error instanceof Error ? error.message : String(error);
			state.usageLoading = false;
			tuiRef.invalidate();
			tuiRef.requestRender();
		});

	// Show panel immediately; tuiRef is captured by the custom component below
	await showStatusPanel(ctx, state, tuiRef);
}
