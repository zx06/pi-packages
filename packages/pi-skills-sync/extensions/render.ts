import type { Theme } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import type { SkillListDetails } from "../src/types";
import { timeAgo } from "../src/utils";

const MAX_COLLAPSED_SKILLS = 6;

export interface SkillListRenderOptions {
	expanded: boolean;
	outputPad?: number;
}

export function renderSkillListEntry(
	details: SkillListDetails | undefined,
	options: SkillListRenderOptions,
	theme: Theme,
) {
	const box = new Box(
		options.outputPad ?? 1,
		1,
		(text) => theme.bg("customMessageBg", text),
	);

	if (!details) {
		box.addChild(new Text(theme.fg("dim", "No skill sync data"), 0, 0));
		return box;
	}

	const title = `${theme.fg("accent", "🔗 pi-skills-sync")} ${theme.fg("dim", `${details.sources.length} skill${details.sources.length === 1 ? "" : "s"}`)}`;
	box.addChild(new Text(title, 0, 0));

	const token = details.hasToken ? theme.fg("success", "✅") : theme.fg("error", "❌");
	const index = details.indexGistId
		? theme.fg("accent", `https://gist.github.com/${details.indexGistId}`)
		: theme.fg("error", "not configured");
	const autoSync = details.autoSync ? theme.fg("success", "on") : theme.fg("dim", "off");
	box.addChild(
		new Text(
			`${theme.fg("dim", "Token")} ${token}  ${theme.fg("dim", "Index")} ${index}  ${theme.fg("dim", "Auto-sync")} ${autoSync}`,
			0,
			0,
		),
	);

	if (details.sources.length === 0) {
		box.addChild(new Text(theme.fg("dim", "No skills. Use /ss:add or /ss:import."), 0, 0));
		return box;
	}

	const visible = options.expanded
		? details.sources
		: details.sources.slice(0, MAX_COLLAPSED_SKILLS);

	for (const source of visible) {
		const age = source.lastSync ? timeAgo(new Date(source.lastSync)) : "never";
		let line = `${theme.fg("success", "•")} ${theme.bold(source.name)} ${theme.fg("dim", `synced ${age}`)}`;
		if (options.expanded) {
			line += `\n  ${theme.fg("dim", `https://gist.github.com/${source.gistId}`)}`;
			line += `\n  ${theme.fg("dim", source.localPath)}`;
		}
		box.addChild(new Text(line, 0, 0));
	}

	if (!options.expanded && details.sources.length > visible.length) {
		box.addChild(
			new Text(
				theme.fg("dim", `… ${details.sources.length - visible.length} more skills (ctrl+e to expand)`),
				0,
				0,
			),
		);
	}

	return box;
}
