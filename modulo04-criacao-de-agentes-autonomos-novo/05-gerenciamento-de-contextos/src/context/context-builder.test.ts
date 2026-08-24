import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContext,
  DEFAULT_SECTION_BUDGETS,
  formatMemoriesForPrompt,
  resolveSectionBudgets,
  type BuildInput,
} from "./context-builder.js";
import { estimateTokens } from "./tokens.js";
import type { ConversationMessage, RecalledMemory } from "../domain/types.js";

function msg(
  id: string,
  role: "user" | "assistant",
  content: string,
): ConversationMessage {
  return { id, conversationId: "c", role, content, createdAt: Number(id) };
}

function baseInput(partial: Partial<BuildInput> = {}): BuildInput {
  return {
    system: "SYSTEM_PROMPT_UNTOUCHABLE",
    summary: null,
    history: [],
    memories: [],
    message: "current-message",
    ...partial,
  };
}

test("resolveSectionBudgets: defaults 200/1200/300", () => {
  const b = resolveSectionBudgets(undefined, {});
  assert.deepEqual(b, DEFAULT_SECTION_BUDGETS);
  assert.equal(b.summary, 200);
  assert.equal(b.history, 1200);
  assert.equal(b.memories, 300);
});

test("resolveSectionBudgets: valid env + invalid → default + overrides win", () => {
  const fromEnv = resolveSectionBudgets(undefined, {
    CONTEXT_BUDGET_SUMMARY: "10",
    CONTEXT_BUDGET_HISTORY: "nope",
    CONTEXT_BUDGET_MEMORIES: "40",
    CONTEXT_BUDGET_SYSTEM: "100",
  });
  assert.equal(fromEnv.summary, 10);
  assert.equal(fromEnv.history, 1200);
  assert.equal(fromEnv.memories, 40);
  assert.equal(fromEnv.system, 100);

  const overridden = resolveSectionBudgets(
    { summary: 5, history: 0 },
    { CONTEXT_BUDGET_SUMMARY: "99" },
  );
  assert.equal(overridden.summary, 5);
  assert.equal(overridden.history, 0);
});

test("resolveSectionBudgets: CONTEXT_BUDGET_HISTORY preferred; WINDOW is legacy alias", () => {
  assert.equal(
    resolveSectionBudgets(undefined, { CONTEXT_BUDGET_HISTORY: "300" }).history,
    300,
  );
  assert.equal(
    resolveSectionBudgets(undefined, { CONTEXT_BUDGET_WINDOW: "250" }).history,
    250,
  );
  assert.equal(
    resolveSectionBudgets(undefined, {
      CONTEXT_BUDGET_HISTORY: "300",
      CONTEXT_BUDGET_WINDOW: "250",
    }).history,
    300,
  );
});

test("resolveSectionBudgets: ≤0 kept for empty-section semantics", () => {
  const b = resolveSectionBudgets({ summary: 0, history: -1, memories: 0 }, {});
  assert.equal(b.summary, 0);
  assert.equal(b.history, -1);
  assert.equal(b.memories, 0);
});

test("buildContext: omits empty blocks; keeps system + message; order summary→memories→current", () => {
  const empty = buildContext(baseInput());
  assert.equal(empty.system, "SYSTEM_PROMPT_UNTOUCHABLE");
  assert.equal(empty.message, "current-message");
  assert.equal(empty.enrichedMessage, "current-message");
  assert.equal(empty.summary, "");
  assert.equal(empty.historyMessages, 0);
  assert.equal(empty.recalledMemories, 0);

  const full = buildContext(
    baseInput({
      summary: "decisão X",
      memories: [{ id: "m1", fact: "pref Y", score: 0.9 }],
    }),
  );
  assert.match(full.enrichedMessage, /^Conversation summary:\ndecisão X\n\n/);
  assert.match(full.enrichedMessage, /Relevant memories:\n- pref Y\n\n/);
  assert.match(full.enrichedMessage, /Current message:\ncurrent-message$/);
});

test("formatMemoriesForPrompt still works", () => {
  assert.equal(formatMemoriesForPrompt([], "oi"), "oi");
  assert.match(
    formatMemoriesForPrompt([{ id: "1", fact: "f", score: 1 }], "q"),
    /Relevant memories:/,
  );
});

test("buildContext: defaults enforce section ceilings", () => {
  const longSummary = "x".repeat(200 * 4 + 40);
  const longHist = Array.from({ length: 8 }, (_, i) =>
    msg(String(i), "user", "h".repeat(400)),
  );
  const longMems: RecalledMemory[] = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    fact: "f".repeat(500),
    score: 1 - i * 0.1,
  }));

  const built = buildContext(
    baseInput({
      summary: longSummary,
      history: longHist,
      memories: longMems,
    }),
  );

  assert.ok(estimateTokens(built.summary) <= 200);
  assert.ok(estimateTokens(built.historyText) <= 1200);
  assert.ok(estimateTokens(built.memoriesText) <= 300);
  assert.equal(built.system, "SYSTEM_PROMPT_UNTOUCHABLE");
  assert.equal(built.message, "current-message");
});

test("buildContext: custom budgets; system+message intact when optional budgets tiny", () => {
  const built = buildContext(
    baseInput({
      system: "S".repeat(500),
      message: "M".repeat(500),
      summary: "summary-text-here",
      history: [msg("1", "user", "old"), msg("2", "assistant", "new")],
      memories: [
        { id: "a", fact: "high", score: 0.9 },
        { id: "b", fact: "low", score: 0.1 },
      ],
    }),
    { budgets: { summary: 0, history: 0, memories: 0 } },
  );
  assert.equal(built.system, "S".repeat(500));
  assert.equal(built.message, "M".repeat(500));
  assert.equal(built.summary, "");
  assert.equal(built.history.length, 0);
  assert.equal(built.memories.length, 0);
  assert.equal(built.enrichedMessage, "M".repeat(500));
});

test("buildContext: history drops oldest first; truncates sole oversized", () => {
  const history = [
    msg("1", "user", "AAAA"),
    msg("2", "assistant", "BBBB"),
    msg("3", "user", "CCCC"),
  ];
  const built = buildContext(baseInput({ history }), {
    budgets: { history: 4, summary: 200, memories: 300 },
  });
  assert.ok(estimateTokens(built.historyText) <= 4);
  assert.ok(built.history.length >= 1);
  // Prefer recent: if we dropped any, id "1" (oldest) should be gone first
  if (built.history.length < 3) {
    assert.equal(
      built.history.some((m) => m.id === "1"),
      false,
    );
  }

  const sole = buildContext(
    baseInput({ history: [msg("9", "user", "Z".repeat(100))] }),
    { budgets: { history: 2, summary: 200, memories: 300 } },
  );
  assert.equal(sole.history.length, 1);
  assert.ok(estimateTokens(sole.historyText) <= 2);
});

test("buildContext: memories drop lowest score; tie drops higher index; truncates sole", () => {
  const memories: RecalledMemory[] = [
    { id: "a", fact: "FACT_A_AAAA", score: 0.5 },
    { id: "b", fact: "FACT_B_BBBB", score: 0.9 },
    { id: "c", fact: "FACT_C_CCCC", score: 0.5 },
  ];
  // Tight budget: keep highest score first.
  const built = buildContext(baseInput({ memories }), {
    budgets: { memories: 4, summary: 200, history: 1200 },
  });
  assert.ok(built.memories.every((m) => m.id !== "c" || built.memories.length === 1));
  // With ties at 0.5, higher index (c) should drop before a when needed
  if (built.memories.length === 2) {
    assert.deepEqual(
      built.memories.map((m) => m.id).sort(),
      ["a", "b"],
    );
  }
  if (built.memories.length === 1) {
    assert.equal(built.memories[0]!.id, "b");
  }
  assert.ok(estimateTokens(built.memoriesText) <= 4);

  const sole = buildContext(
    baseInput({ memories: [{ id: "x", fact: "F".repeat(100), score: 1 }] }),
    { budgets: { memories: 2, summary: 200, history: 1200 } },
  );
  assert.equal(sole.memories.length, 1);
  assert.ok(estimateTokens(sole.memoriesText) <= 2);
});

test("buildContext: low ceilings simultaneous; system+message untouched", () => {
  const built = buildContext(
    baseInput({
      system: "KEEP_SYS",
      message: "KEEP_MSG",
      summary: "S".repeat(80),
      history: [msg("1", "user", "old-hist"), msg("2", "user", "new-hist")],
      memories: [
        { id: "lo", fact: "low-mem", score: 0.2 },
        { id: "hi", fact: "high-mem", score: 0.95 },
      ],
    }),
    { budgets: { summary: 3, history: 5, memories: 3 } },
  );
  assert.equal(built.system, "KEEP_SYS");
  assert.equal(built.message, "KEEP_MSG");
  assert.ok(estimateTokens(built.summary) <= 3);
  assert.ok(estimateTokens(built.historyText) <= 5);
  assert.ok(estimateTokens(built.memoriesText) <= 3);
});

test("buildContext: content that fits is not removed", () => {
  const history = [msg("1", "user", "a"), msg("2", "assistant", "b")];
  const memories = [
    { id: "1", fact: "f1", score: 0.8 },
    { id: "2", fact: "f2", score: 0.7 },
  ];
  const built = buildContext(
    baseInput({ summary: "short", history, memories }),
    { budgets: { summary: 200, history: 1200, memories: 300 } },
  );
  assert.equal(built.summary, "short");
  assert.equal(built.history.length, 2);
  assert.equal(built.memories.length, 2);
});
