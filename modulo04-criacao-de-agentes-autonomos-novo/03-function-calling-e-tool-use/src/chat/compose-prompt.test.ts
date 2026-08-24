import assert from "node:assert/strict";
import test from "node:test";

import { composeChatPrompt, HISTORY_LIMIT } from "./compose-prompt.js";
import { formatHistoryForPrompt, runChat } from "./run-chat.js";
import type { ReasoningStrategy, StrategyResult, StrategyRunInput } from "../domain/types.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";

test("HISTORY_LIMIT is 12", () => {
  assert.equal(HISTORY_LIMIT, 12);
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

test("runChat create + historyMessages 0 + persists turn", async () => {
  const conversations = new SqliteConversationStore(":memory:");
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

  const result = await runChat(conversations, strategy, { message: "primeira" });
  assert.equal(result.metrics.historyMessages, 0);
  assert.ok(result.conversationId);
  assert.equal(conversations.lastMessages(result.conversationId, 12).length, 2);
});

test("runChat second turn injects history", async () => {
  const conversations = new SqliteConversationStore(":memory:");
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

  const first = await runChat(conversations, strategy, { message: "um" });
  const second = await runChat(conversations, strategy, {
    message: "dois",
    conversationId: first.conversationId,
  });

  assert.equal(second.metrics.historyMessages, 2);
  assert.equal(seen[1]?.history.length, 2);
  assert.equal(seen[1]?.history[0]?.content, "um");
  assert.equal(seen[1]?.history[1]?.content, "echo:um");
});
