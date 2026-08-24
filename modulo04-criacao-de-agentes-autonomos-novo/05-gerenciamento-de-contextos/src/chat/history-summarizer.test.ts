import assert from "node:assert/strict";
import test from "node:test";

import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import {
  createFakeConversationSummarizer,
  HISTORY_LIMIT,
  maybeSummarize,
  SUMMARY_BATCH_SIZE,
  SUMMARIZER_PROMPT,
} from "./history-summarizer.js";

function seedMessages(
  store: SqliteConversationStore,
  conversationId: string,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    store.append(conversationId, i % 2 === 0 ? "user" : "assistant", `m${i}`);
  }
}

test("SUMMARIZER_PROMPT mentions 150 tokens and decisões", () => {
  assert.match(SUMMARIZER_PROMPT, /150 tokens/);
  assert.match(SUMMARIZER_PROMPT, /decisões/i);
});

test("maybeSummarize: pending < 8 → summarizer not called", async () => {
  const store = new SqliteConversationStore(":memory:");
  const cid = store.create();
  seedMessages(store, cid, HISTORY_LIMIT + SUMMARY_BATCH_SIZE - 1); // 15
  let calls = 0;
  const summarizer = createFakeConversationSummarizer(() => {
    calls += 1;
  });

  const result = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer,
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
  assert.equal(store.getSummary(cid), null);
});

test("maybeSummarize: total=16 covered=0 → one call, covered=8, summarize event", async () => {
  const store = new SqliteConversationStore(":memory:");
  const cid = store.create();
  seedMessages(store, cid, 16);
  let calls = 0;
  const summarizer = createFakeConversationSummarizer((input) => {
    calls += 1;
    assert.equal(input.previousSummary, null);
    assert.equal(input.batch.length, 8);
    assert.equal(input.batch[0]?.content, "m0");
  });

  const result = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer,
  });
  assert.ok(result);
  assert.equal(calls, 1);
  assert.equal(result.event.type, "summarize");
  assert.equal(result.summaryText, result.event.content);
  const saved = store.getSummary(cid);
  assert.ok(saved);
  assert.equal(saved.coveredCount, 8);
  assert.equal(saved.text, result.summaryText);
});

test("maybeSummarize: second call without new batch → null, same text", async () => {
  const store = new SqliteConversationStore(":memory:");
  const cid = store.create();
  seedMessages(store, cid, 16);
  let calls = 0;
  const summarizer = createFakeConversationSummarizer(() => {
    calls += 1;
  });

  await maybeSummarize({ conversations: store, conversationId: cid, summarizer });
  const first = store.getSummary(cid)?.text;
  const second = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer,
  });
  assert.equal(second, null);
  assert.equal(calls, 1);
  assert.equal(store.getSummary(cid)?.text, first);
});

test("maybeSummarize: second batch merges previous summary", async () => {
  const store = new SqliteConversationStore(":memory:");
  const cid = store.create();
  seedMessages(store, cid, 24);
  const seen: Array<string | null> = [];
  const summarizer = createFakeConversationSummarizer((input) => {
    seen.push(input.previousSummary);
  });

  const first = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer,
  });
  assert.ok(first);
  const second = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer,
  });
  assert.ok(second);
  assert.equal(seen.length, 2);
  assert.equal(seen[0], null);
  assert.equal(seen[1], first.summaryText);
  assert.match(second.summaryText, /merge\(/);
  assert.equal(store.getSummary(cid)?.coveredCount, 16);
});

test("maybeSummarize: summarizer throw is fail-safe", async () => {
  const store = new SqliteConversationStore(":memory:");
  const cid = store.create();
  seedMessages(store, cid, 16);
  const result = await maybeSummarize({
    conversations: store,
    conversationId: cid,
    summarizer: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(result, null);
  assert.equal(store.getSummary(cid), null);
});
