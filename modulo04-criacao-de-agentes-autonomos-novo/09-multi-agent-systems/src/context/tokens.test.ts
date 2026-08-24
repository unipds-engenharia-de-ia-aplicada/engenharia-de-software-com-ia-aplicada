import assert from "node:assert/strict";
import test from "node:test";

import {
  addPromptTokens,
  buildContextBreakdown,
  estimateTokens,
  readLlmUsage,
  sumPromptTokensFromMessages,
} from "./tokens.js";

test("estimateTokens: empty and short strings use floor(n/4)", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 0);
  assert.equal(estimateTokens("ab"), 0);
  assert.equal(estimateTokens("abc"), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 1);
});

test("estimateTokens: accented PT string uses JS string.length", () => {
  const text = "ação"; // length 4 in JS
  assert.equal(text.length, 4);
  assert.equal(estimateTokens(text), 1);
});

test("readLlmUsage: usage_metadata.input_tokens", () => {
  const usage = readLlmUsage({
    usage_metadata: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
  });
  assert.deepEqual(usage, {
    promptTokens: 10,
    completionTokens: 2,
    totalTokens: 12,
  });
});

test("readLlmUsage: tokenUsage.promptTokens fallback", () => {
  const usage = readLlmUsage({
    response_metadata: {
      tokenUsage: { promptTokens: 28, completionTokens: 5, totalTokens: 33 },
    },
  });
  assert.deepEqual(usage, {
    promptTokens: 28,
    completionTokens: 5,
    totalTokens: 33,
  });
});

test("readLlmUsage: malformed / undefined → undefined", () => {
  assert.equal(readLlmUsage(undefined), undefined);
  assert.equal(readLlmUsage(null), undefined);
  assert.equal(readLlmUsage({}), undefined);
  assert.equal(readLlmUsage({ usage_metadata: { input_tokens: -1 } }), undefined);
  assert.equal(readLlmUsage("nope"), undefined);
});

test("sumPromptTokensFromMessages: sum or undefined", () => {
  assert.equal(
    sumPromptTokensFromMessages([
      { usage_metadata: { input_tokens: 10, output_tokens: 1, total_tokens: 11 } },
      { usage_metadata: { input_tokens: 5, output_tokens: 1, total_tokens: 6 } },
    ]),
    15,
  );
  assert.equal(sumPromptTokensFromMessages([{}, { content: "x" }]), undefined);
  assert.equal(sumPromptTokensFromMessages([]), undefined);
});

test("buildContextBreakdown maps keys to estimateTokens", () => {
  const parts = {
    system: "abcd",
    history: "abcdefgh",
    memories: "",
    message: "abc",
    summary: "xy",
  };
  assert.deepEqual(buildContextBreakdown(parts), {
    system: estimateTokens(parts.system),
    history: estimateTokens(parts.history),
    memories: 0,
    message: estimateTokens(parts.message),
    summary: estimateTokens(parts.summary),
  });
  assert.equal(buildContextBreakdown({ ...parts, summary: undefined }).summary, 0);
});

test("addPromptTokens aggregates optionals", () => {
  assert.equal(addPromptTokens(undefined, undefined), undefined);
  assert.equal(addPromptTokens(undefined, 10), 10);
  assert.equal(addPromptTokens(10, undefined), 10);
  assert.equal(addPromptTokens(10, 5), 15);
});
