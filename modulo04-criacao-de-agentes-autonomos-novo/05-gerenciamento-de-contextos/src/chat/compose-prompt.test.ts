import assert from "node:assert/strict";
import test from "node:test";

import { OPSPILOT_SYSTEM_PROMPT } from "../agents/system-prompt.js";
import { estimateTokens } from "../context/tokens.js";
import { createFakeConversationSummarizer } from "./history-summarizer.js";
import { composeChatPrompt, HISTORY_LIMIT } from "./compose-prompt.js";
import {
  formatHistoryForPrompt,
  formatMemoriesForPrompt,
  runChat,
} from "./run-chat.js";
import type { ReasoningStrategy, StrategyResult, StrategyRunInput } from "../domain/types.js";
import { FakeEmbedder } from "../memory/fake-embedder.js";
import { SqliteMemoryStore } from "../memory/memory-store.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";

test("HISTORY_LIMIT is 8", () => {
  assert.equal(HISTORY_LIMIT, 8);
});

test("composeChatPrompt / formatHistoryForPrompt: empty history returns message", () => {
  assert.equal(composeChatPrompt([], "oi"), "oi");
  assert.equal(formatHistoryForPrompt([], "oi"), "oi");
});

test("composeChatPrompt formats prior turns", () => {
  const formatted = composeChatPrompt(
    [
      {
        id: "1",
        conversationId: "c",
        role: "user",
        content: "a",
        createdAt: 1,
      },
      {
        id: "2",
        conversationId: "c",
        role: "assistant",
        content: "b",
        createdAt: 2,
      },
    ],
    "agora",
  );
  assert.match(formatted, /Previous conversation:/);
  assert.match(formatted, /user: a/);
  assert.match(formatted, /assistant: b/);
  assert.match(formatted, /Current message:\nagora/);
});

test("formatMemoriesForPrompt: empty returns message", () => {
  assert.equal(formatMemoriesForPrompt([], "oi"), "oi");
});

test("formatMemoriesForPrompt: includes Relevant memories block", () => {
  const formatted = formatMemoriesForPrompt(
    [{ id: "1", fact: "checkout lento", score: 0.8 }],
    "status?",
  );
  assert.match(formatted, /Relevant memories:/);
  assert.match(formatted, /- checkout lento/);
  assert.match(formatted, /Current message:\nstatus\?/);
});

test("runChat create + historyMessages 0 + persists turn", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      assert.equal(input.history.length, 0);
      assert.equal(input.message, "primeira");
      return {
        answer: "resposta",
        trace: [{ type: "answer", content: "resposta" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const result = await runChat(conversations, memories, strategy, {
    message: "primeira",
    userId: "u1",
  });
  assert.equal(result.metrics.historyMessages, 0);
  assert.equal(result.metrics.recalledMemories, 0);
  assert.ok(result.conversationId);
  assert.equal(conversations.lastMessages(result.conversationId, 12).length, 2);
});

test("runChat second turn injects history", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const seen: StrategyRunInput[] = [];
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      seen.push(input);
      return {
        answer: `echo:${input.message}`,
        trace: [{ type: "answer", content: `echo:${input.message}` }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const first = await runChat(conversations, memories, strategy, {
    message: "um",
    userId: "u1",
  });
  const second = await runChat(conversations, memories, strategy, {
    message: "dois",
    userId: "u1",
    conversationId: first.conversationId,
  });

  assert.equal(second.metrics.historyMessages, 2);
  assert.equal(seen[1]?.history.length, 2);
  assert.equal(seen[1]?.history[0]?.content, "um");
  assert.equal(seen[1]?.history[1]?.content, "echo:um");
});

test("runChat: promptTokens from strategy appears; omitted when absent", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());

  const withTokens: ReasoningStrategy = {
    name: "fake",
    async run(): Promise<StrategyResult> {
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1, promptTokens: 42 },
      };
    },
  };
  const withResult = await runChat(conversations, memories, withTokens, {
    message: "hello",
    userId: "u1",
  });
  assert.equal(withResult.metrics.promptTokens, 42);

  const withoutTokens: ReasoningStrategy = {
    name: "fake",
    async run(): Promise<StrategyResult> {
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };
  const withoutResult = await runChat(conversations, memories, withoutTokens, {
    message: "hello2",
    userId: "u1",
  });
  assert.equal(withoutResult.metrics.promptTokens, undefined);
  assert.equal("promptTokens" in withoutResult.metrics, false);
});

test("runChat: contextBreakdown always has five keys; empty hist/mem/summary → 0", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(): Promise<StrategyResult> {
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const message = "abcd";
  const result = await runChat(conversations, memories, strategy, {
    message,
    userId: "u-breakdown",
  });

  const bd = result.metrics.contextBreakdown;
  assert.deepEqual(Object.keys(bd).sort(), [
    "history",
    "memories",
    "message",
    "summary",
    "system",
  ]);
  assert.equal(bd.history, 0);
  assert.equal(bd.memories, 0);
  assert.equal(bd.summary, 0);
  assert.equal(bd.message, estimateTokens(message));
  assert.equal(bd.system, estimateTokens(OPSPILOT_SYSTEM_PROMPT));
  assert.ok(bd.system > 0);
});

test("runChat: strategy receives builder enrichedMessage (summary envelope)", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const cid = conversations.create();
  conversations.upsertSummary(cid, "fato importante", 0);

  const seen: StrategyRunInput[] = [];
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      seen.push(input);
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  await runChat(conversations, memories, strategy, {
    message: "status?",
    userId: "u-builder",
    conversationId: cid,
  });

  assert.match(seen[0]?.message ?? "", /Conversation summary:/);
  assert.match(seen[0]?.message ?? "", /fato importante/);
  assert.match(seen[0]?.message ?? "", /status\?/);
});

test("runChat: low budgets → post-cut metrics (historyMessages / breakdown)", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const cid = conversations.create();
  for (let i = 0; i < 6; i += 1) {
    conversations.append(
      cid,
      i % 2 === 0 ? "user" : "assistant",
      `pad-${i}-${"x".repeat(40)}`,
    );
  }
  conversations.upsertSummary(cid, "S".repeat(80), 0);

  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(): Promise<StrategyResult> {
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const result = await runChat(
    conversations,
    memories,
    strategy,
    { message: "agora", userId: "u1", conversationId: cid },
    { budgets: { summary: 3, history: 20, memories: 0 } },
  );

  assert.ok(result.metrics.historyMessages < 6);
  assert.ok(result.metrics.contextBreakdown.summary <= 3);
  assert.ok(result.metrics.contextBreakdown.history <= 20);
  assert.equal(result.metrics.contextBreakdown.memories, 0);
  assert.equal(result.metrics.recalledMemories, 0);
});

test("runChat: summarizer triggers at 16 msgs; injects summary; no recompute next turn", async () => {
  const conversations = new SqliteConversationStore(":memory:");
  const memories = new SqliteMemoryStore(":memory:", new FakeEmbedder());
  const cid = conversations.create();
  for (let i = 0; i < 16; i += 1) {
    conversations.append(cid, i % 2 === 0 ? "user" : "assistant", `seed-${i}`);
  }

  let calls = 0;
  const summarizer = createFakeConversationSummarizer(() => {
    calls += 1;
  });
  const seen: string[] = [];
  const strategy: ReasoningStrategy = {
    name: "fake",
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      seen.push(input.message);
      assert.equal(input.history.length, 8);
      return {
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 1, latencyMs: 1 },
      };
    },
  };

  const first = await runChat(
    conversations,
    memories,
    strategy,
    { message: "after-seed", userId: "u1", conversationId: cid },
    { summarizer },
  );
  assert.equal(calls, 1);
  assert.equal(first.trace[0]?.type, "summarize");
  assert.equal(first.metrics.historyMessages, 8);
  assert.match(seen[0] ?? "", /Conversation summary:/);
  assert.ok((first.metrics.contextBreakdown.summary ?? 0) > 0);

  const second = await runChat(
    conversations,
    memories,
    strategy,
    { message: "again", userId: "u1", conversationId: cid },
    { summarizer },
  );
  assert.equal(calls, 1);
  assert.notEqual(second.trace[0]?.type, "summarize");
  assert.match(seen[1] ?? "", /Conversation summary:/);
});
