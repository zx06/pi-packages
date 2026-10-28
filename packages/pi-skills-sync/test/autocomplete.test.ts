import test from "node:test";
import assert from "node:assert/strict";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { createSkillAutocompleteProvider } from "../extensions/autocomplete.ts";
import type { SkillSource } from "../src/types.ts";

const source: SkillSource = {
	name: "pdf-tools",
	gistId: "abc12345",
	owner: "tester",
	public: false,
	localPath: "/tmp/pdf-tools",
	lastSync: new Date().toISOString(),
	needsSync: false,
};

const current: AutocompleteProvider = {
	async getSuggestions() {
		return { items: [{ value: "fallback", label: "fallback" }], prefix: "" };
	},
	applyCompletion(lines, cursorLine, cursorCol) {
		return { lines, cursorLine, cursorCol };
	},
};

test("completes #name at the start of a prompt", async () => {
	const provider = createSkillAutocompleteProvider(current, async () => [source]);
	const suggestions = await provider.getSuggestions(["#pdf"], 0, 4, {
		signal: new AbortController().signal,
	});

	assert.equal(suggestions?.prefix, "#pdf");
	assert.equal(suggestions?.items[0]?.value, "/skill:pdf-tools");

	const applied = provider.applyCompletion(["#pdf"], 0, 4, suggestions!.items[0], suggestions!.prefix);
	assert.deepEqual(applied.lines, ["/skill:pdf-tools"]);
	assert.equal(applied.cursorCol, "/skill:pdf-tools".length);
});

test("falls through for mid-text # tokens", async () => {
	const provider = createSkillAutocompleteProvider(current, async () => [source]);
	const suggestions = await provider.getSuggestions(["use #pdf"], 0, 8, {
		signal: new AbortController().signal,
	});

	assert.equal(suggestions?.items[0]?.value, "fallback");
});

test("falls through when no skill matches", async () => {
	const provider = createSkillAutocompleteProvider(current, async () => [source]);
	const suggestions = await provider.getSuggestions(["#zzz"], 0, 4, {
		signal: new AbortController().signal,
	});

	assert.equal(suggestions?.items[0]?.value, "fallback");
});
