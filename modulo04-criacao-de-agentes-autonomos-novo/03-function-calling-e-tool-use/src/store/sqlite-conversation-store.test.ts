import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConversationNotFoundError } from "../domain/errors.js";
import { SqliteConversationStore } from "./sqlite-conversation-store.js";

test("create then lastMessages returns empty", () => {
  const store = new SqliteConversationStore(":memory:");
  const id = store.create();
  assert.equal(typeof id, "string");
  assert.deepEqual(store.lastMessages(id, 12), []);
});

test("append user+assistant round-trip in chronological order", () => {
  const store = new SqliteConversationStore(":memory:");
  const id = store.create();
  store.append(id, "user", "olá");
  store.append(id, "assistant", "oi!");
  const msgs = store.lastMessages(id, 12);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0]?.role, "user");
  assert.equal(msgs[0]?.content, "olá");
  assert.equal(msgs[1]?.role, "assistant");
  assert.equal(msgs[1]?.content, "oi!");
});

test("lastMessages respects limit of 12 (keeps most recent)", () => {
  const store = new SqliteConversationStore(":memory:");
  const id = store.create();
  for (let i = 0; i < 15; i += 1) {
    store.append(id, i % 2 === 0 ? "user" : "assistant", `m${i}`);
  }
  const msgs = store.lastMessages(id, 12);
  assert.equal(msgs.length, 12);
  assert.equal(msgs[0]?.content, "m3");
  assert.equal(msgs[11]?.content, "m14");
});

test("append and lastMessages throw ConversationNotFoundError for unknown id", () => {
  const store = new SqliteConversationStore(":memory:");
  const missing = randomUUID();
  assert.throws(() => store.append(missing, "user", "x"), ConversationNotFoundError);
  assert.throws(() => store.lastMessages(missing, 12), ConversationNotFoundError);
});
