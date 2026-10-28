import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { fuzzyFilter } from "@earendil-works/pi-tui";
import type { SkillSource } from "../src/types";
import { timeAgo } from "../src/utils";

const MAX_SUGGESTIONS = 20;

/**
 * `#name` at the start of a prompt completes to `/skill:name` for a synced
 * skill. Restricting the trigger to the line start avoids conflicting with
 * mid-text `#` autocomplete providers (for example GitHub issues).
 */
export function createSkillAutocompleteProvider(
	current: AutocompleteProvider,
	getSources: () => Promise<SkillSource[]>,
): AutocompleteProvider {
	return {
		triggerCharacters: ["#"],
		async getSuggestions(lines, cursorLine, cursorCol, options) {
			const line = lines[cursorLine] ?? "";
			const match = line.slice(0, cursorCol).match(/^#([^\s#]*)$/);
			if (!match) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const token = match[1];
			const sources = await getSources();
			if (options.signal.aborted || sources.length === 0) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const matches = token
				? fuzzyFilter(sources, token, (source) => `${source.name} ${source.gistId}`)
				: sources;
			const items = matches.slice(0, MAX_SUGGESTIONS).map((source) => ({
				value: `/skill:${source.name}`,
				label: source.name,
				description: source.lastSync
					? `synced ${timeAgo(new Date(source.lastSync))}`
					: `gist ${source.gistId.slice(0, 8)}`,
			}));

			if (items.length === 0) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			return { items, prefix: `#${token}` };
		},
		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			const line = lines[cursorLine] ?? "";
			const start = line.lastIndexOf(prefix, cursorCol);
			if (start === -1) {
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			}

			const nextLines = [...lines];
			nextLines[cursorLine] = line.slice(0, start) + item.value + line.slice(cursorCol);
			return {
				lines: nextLines,
				cursorLine,
				cursorCol: start + item.value.length,
			};
		},
		shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}
