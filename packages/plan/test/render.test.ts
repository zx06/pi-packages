import test from "node:test";
import assert from "node:assert/strict";
import { transformDoneMarkers } from "../extensions/plan/render.ts";

test("transformDoneMarkers renders step badges", () => {
	assert.equal(
		transformDoneMarkers("Finished step [DONE:1] and [done:2]."),
		"Finished step `✓ step 1` and `✓ step 2`.",
	);
});

test("transformDoneMarkers keeps fenced code blocks untouched", () => {
	const input = [
		"Before [DONE:1]",
		"```text",
		"[DONE:2]",
		"```",
		"After [DONE:3]",
	].join("\n");

	assert.equal(
		transformDoneMarkers(input),
		[
			"Before `✓ step 1`",
			"```text",
			"[DONE:2]",
			"```",
			"After `✓ step 3`",
		].join("\n"),
	);
});
