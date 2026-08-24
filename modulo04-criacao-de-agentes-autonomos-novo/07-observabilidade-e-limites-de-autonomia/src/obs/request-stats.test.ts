import assert from "node:assert/strict";
import test from "node:test";

import {
  estimatePromptCostUsd,
  parseSinceDuration,
  percentile,
} from "./request-stats.js";

test("parseSinceDuration accepts 24h / 7d / 30m", () => {
  assert.equal(parseSinceDuration("24h"), 24 * 3_600_000);
  assert.equal(parseSinceDuration("7d"), 7 * 86_400_000);
  assert.equal(parseSinceDuration("30m"), 30 * 60_000);
  assert.equal(parseSinceDuration("bad"), null);
});

test("percentile p50/p95", () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([10, 20, 30, 40, 50], 50), 30);
  assert.equal(percentile([10, 20, 30, 40, 50], 95), 50);
});

test("estimatePromptCostUsd: :free is 0", () => {
  assert.equal(estimatePromptCostUsd("openai/gpt-4o-mini:free", 1_000_000), 0);
  assert.ok(estimatePromptCostUsd("openai/gpt-4o-mini", 1_000_000) > 0);
});
