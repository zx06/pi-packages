import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractDoneSteps,
  markCompletedSteps,
  getCompletionStats,
} from "../src/progress.js";
import type { PlanStep } from "../src/types.js";

describe("extractDoneSteps", () => {
  it("extracts single DONE marker", () => {
    assert.deepEqual(extractDoneSteps("I did [DONE:1] this step."), [1]);
  });

  it("extracts multiple DONE markers", () => {
    assert.deepEqual(
      extractDoneSteps("[DONE:1] and [DONE:3] are done"),
      [1, 3]
    );
  });

  it("returns empty for no markers", () => {
    assert.deepEqual(extractDoneSteps("No markers here"), []);
  });

  it("handles case insensitive", () => {
    assert.deepEqual(extractDoneSteps("[done:2]"), [2]);
  });
});

describe("markCompletedSteps", () => {
  it("marks matching steps as completed", () => {
    const items: PlanStep[] = [
      { step: 1, text: "First", completed: false },
      { step: 2, text: "Second", completed: false },
      { step: 3, text: "Third", completed: false },
    ];
    const count = markCompletedSteps("Done [DONE:1] and [DONE:3]", items);
    assert.equal(count, 2);
    assert.equal(items[0].completed, true);
    assert.equal(items[1].completed, false);
    assert.equal(items[2].completed, true);
  });

  it("does not double-count already completed steps", () => {
    const items: PlanStep[] = [
      { step: 1, text: "First", completed: true },
      { step: 2, text: "Second", completed: false },
    ];
    const count = markCompletedSteps("[DONE:1] [DONE:2]", items);
    assert.equal(count, 1); // only step 2 was newly completed
  });

  it("ignores markers for non-existent steps", () => {
    const items: PlanStep[] = [
      { step: 1, text: "First", completed: false },
    ];
    const count = markCompletedSteps("[DONE:99]", items);
    assert.equal(count, 0);
    assert.equal(items[0].completed, false);
  });
});

describe("getCompletionStats", () => {
  it("returns correct stats for mixed completion", () => {
    const steps: PlanStep[] = [
      { step: 1, text: "A", completed: true },
      { step: 2, text: "B", completed: false },
      { step: 3, text: "C", completed: true },
    ];
    const stats = getCompletionStats(steps);
    assert.equal(stats.completed, 2);
    assert.equal(stats.total, 3);
    assert.equal(stats.allDone, false);
  });

  it("reports allDone when all steps completed", () => {
    const steps: PlanStep[] = [
      { step: 1, text: "A", completed: true },
      { step: 2, text: "B", completed: true },
    ];
    const stats = getCompletionStats(steps);
    assert.equal(stats.completed, 2);
    assert.equal(stats.total, 2);
    assert.equal(stats.allDone, true);
  });

  it("handles empty steps", () => {
    const stats = getCompletionStats([]);
    assert.equal(stats.completed, 0);
    assert.equal(stats.total, 0);
    assert.equal(stats.allDone, false);
  });
});
