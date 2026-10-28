import type { MessageRenderOptions, Theme } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import type { PlanMessageDetails, PlanStep } from "../../src/types.js";

export type PlanMessageKind = "todo" | "complete" | "execute";

const MAX_COLLAPSED_STEPS = 8;

function contentText(content: string | Array<{ type: string; text?: string }>): string {
	if (typeof content === "string") return content;
	return content
		.filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

function stepLine(step: PlanStep, theme: Theme): string {
	const number = theme.fg("dim", `${step.step}. `);
	if (step.completed) {
		return (
			number +
			theme.fg("success", "☑ ") +
			theme.fg("muted", theme.strikethrough(step.text))
		);
	}
	return number + theme.fg("muted", "☐ ") + step.text;
}

export function renderPlanMessage(
	kind: PlanMessageKind,
	content: string | Array<{ type: string; text?: string }>,
	details: PlanMessageDetails | undefined,
	options: MessageRenderOptions,
	theme: Theme,
) {
	const steps = details?.steps ?? [];
	const box = new Box(
		options.outputPad,
		1,
		(text) => theme.bg("customMessageBg", text),
	);

	if (steps.length === 0) {
		box.addChild(new Text(contentText(content), 0, 0));
		return box;
	}

	const completed = steps.filter((step) => step.completed).length;
	let title: string;
	if (kind === "complete") {
		title = `${theme.fg("success", "✅ Plan Complete")} ${theme.fg("dim", `${completed}/${steps.length}`)}`;
	} else if (kind === "execute") {
		title = `${theme.fg("accent", "▶ Executing plan")} ${theme.fg("dim", `${steps.length} step${steps.length === 1 ? "" : "s"} remaining`)}`;
	} else {
		title = `${theme.fg("accent", "📋 Plan")} ${theme.fg("dim", `${completed}/${steps.length} completed`)}`;
	}
	box.addChild(new Text(title, 0, 0));

	const visible = options.expanded ? steps : steps.slice(0, MAX_COLLAPSED_STEPS);
	for (const step of visible) {
		box.addChild(new Text(stepLine(step, theme), 0, 0));
	}

	if (!options.expanded && steps.length > visible.length) {
		box.addChild(
			new Text(
				theme.fg("dim", `… ${steps.length - visible.length} more steps (ctrl+e to expand)`),
				0,
				0,
			),
		);
	}

	return box;
}

/**
 * Display-only transform: show `[DONE:n]` markers as inline step badges and
 * leave fenced code blocks untouched. The raw text still drives progress
 * tracking, so this never changes completion state.
 */
export function transformDoneMarkers(markdown: string): string {
	let inFence = false;
	return markdown
		.split("\n")
		.map((line) => {
			if (/^\s*```/.test(line)) {
				inFence = !inFence;
				return line;
			}
			if (inFence) return line;
			return line.replace(/\[DONE:(\d+)\]/gi, (_match, step: string) => `\`✓ step ${step}\``);
		})
		.join("\n");
}
