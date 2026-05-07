import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractPlanSteps, cleanStepText } from "../src/planner.js";

describe("cleanStepText", () => {
  it("removes bold markers", () => {
    assert.equal(cleanStepText("**bold text**"), "Bold text");
  });

  it("removes italic markers", () => {
    assert.equal(cleanStepText("*italic text*"), "Italic text");
  });

  it("removes inline code and capitalizes", () => {
    assert.equal(cleanStepText("`code` here"), "Code here");
  });

  it("removes links and capitalizes", () => {
    assert.equal(cleanStepText("[link](http://example.com)"), "Link");
  });

  it("capitalizes first letter", () => {
    assert.equal(cleanStepText("lowercase start"), "Lowercase start");
  });

  it("truncates long text", () => {
    const long = "a".repeat(100);
    const result = cleanStepText(long);
    assert.ok(result.length <= 60);
    assert.ok(result.endsWith("..."));
  });
});

describe("extractPlanSteps", () => {
  it("extracts numbered steps after 'Plan:' header", () => {
    const msg = `Here is the plan:

Plan:
1. First step
2. Second step
3. Third step

Let me know what you think.`;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 3);
    assert.equal(steps[0].text, "First step");
    assert.equal(steps[1].text, "Second step");
    assert.equal(steps[2].text, "Third step");
    assert.equal(steps[0].step, 1);
    assert.equal(steps[0].completed, false);
  });

  it("extracts from '## Plan:' header", () => {
    const msg = `## Plan:
1. Step one
2. Step two`;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 2);
  });

  it("extracts from '**Plan:**' header", () => {
    const msg = `**Plan:**
1. Step one
2. Step two`;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 2);
  });

  it("extracts unordered list if no numbered items", () => {
    const msg = `Plan:
- First item
- Second item
- Third item`;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 3);
    assert.equal(steps[0].text, "First item");
  });

  it("returns empty if no Plan header", () => {
    const msg = "Just some regular text with no plan.";
    assert.equal(extractPlanSteps(msg).length, 0);
  });

  it("filters out short steps", () => {
    const msg = `Plan:
1. OK
2. This is a valid step`;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].text, "This is a valid step");
  });

  it("cleans markdown from steps", () => {
    const msg = `Plan:
1. **Edit** the \`config.ts\` file
2. Run \`npm test\``;
    const steps = extractPlanSteps(msg);
    assert.equal(steps.length, 2);
    assert.equal(steps[0].text, "Edit the config.ts file");
  });
});
