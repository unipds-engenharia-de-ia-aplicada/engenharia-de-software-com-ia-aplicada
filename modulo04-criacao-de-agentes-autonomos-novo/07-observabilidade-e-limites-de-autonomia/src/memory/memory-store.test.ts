import assert from "node:assert/strict";
import test from "node:test";

import { InvalidMemoryInputError } from "../domain/errors.js";
import { getDefaultEmbedder, EMBEDDING_DIM } from "./embeddings.js";
import { FakeEmbedder } from "./fake-embedder.js";
import { SqliteMemoryStore, dot } from "./memory-store.js";

function nearlyParallel(axis: number, epsilon = 0.05): number[] {
  // unit-ish vector mostly on `axis` with a small orthogonal component → still high cosine
  const values = Array.from({ length: EMBEDDING_DIM }, (_, i) => {
    if (i === axis) return 1;
    if (i === (axis + 1) % EMBEDDING_DIM) return epsilon;
    return 0;
  });
  return values;
}

test("remember inserts fact and returns stored:true", async () => {
  const embedder = new FakeEmbedder().setAxis("checkout latency high", 0);
  const store = new SqliteMemoryStore(":memory:", embedder);
  const result = await store.remember("user-a", "checkout latency high");
  assert.equal(result.stored, true);
  assert.ok(result.id);
  const recalled = await store.recall("user-a", "checkout latency high");
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0]?.fact, "checkout latency high");
  assert.ok((recalled[0]?.score ?? 0) >= 0.3);
});

test("near-duplicate remember with dot > 0.92 is not stored twice", async () => {
  const fact1 = "payment queue backlog";
  const fact2 = "payment queue is backlogged";
  const embedder = new FakeEmbedder()
    .set(fact1, nearlyParallel(3, 0.01))
    .set(fact2, nearlyParallel(3, 0.02));
  assert.ok(dot(await embedder.embed(fact1), await embedder.embed(fact2)) > 0.92);

  const store = new SqliteMemoryStore(":memory:", embedder);
  const first = await store.remember("user-a", fact1);
  const second = await store.remember("user-a", fact2);
  assert.equal(first.stored, true);
  assert.equal(second.stored, false);
  assert.equal(second.id, first.id);

  const count = (
    store.database.prepare(`SELECT COUNT(*) AS c FROM memories WHERE user_id = ?`).get("user-a") as {
      c: number;
    }
  ).c;
  assert.equal(count, 1);
});

test("memories are isolated by userId", async () => {
  const embedder = new FakeEmbedder()
    .setAxis("fact-a", 1)
    .setAxis("fact-b", 2);
  const store = new SqliteMemoryStore(":memory:", embedder);
  await store.remember("alice", "fact-a");
  await store.remember("bob", "fact-b");

  const forAlice = await store.recall("alice", "fact-a");
  const forBob = await store.recall("bob", "fact-b");
  assert.equal(forAlice.length, 1);
  assert.equal(forAlice[0]?.fact, "fact-a");
  assert.equal(forBob.length, 1);
  assert.equal(forBob[0]?.fact, "fact-b");
  assert.equal((await store.recall("alice", "fact-b")).length, 0);
});

test("recall returns top-3 with scores >= 0.3 ordered desc", async () => {
  const embedder = new FakeEmbedder();
  // Query on axis 0. Candidates with decreasing alignment.
  embedder.setAxis("query", 0);
  embedder.set("keep-high", Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 1 : 0)));
  embedder.set(
    "keep-mid",
    Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 0.8 : i === 1 ? 0.6 : 0)),
  );
  embedder.set(
    "keep-low",
    Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 0.5 : i === 2 ? 0.866 : 0)),
  );
  embedder.set(
    "drop-below",
    Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 0.1 : i === 3 ? 0.995 : 0)),
  );
  embedder.set(
    "extra-ok",
    Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 0.4 : i === 4 ? 0.917 : 0)),
  );

  const store = new SqliteMemoryStore(":memory:", embedder);
  for (const fact of ["keep-high", "keep-mid", "keep-low", "drop-below", "extra-ok"]) {
    await store.remember("u", fact);
  }

  const recalled = await store.recall("u", "query");
  assert.ok(recalled.length <= 3);
  assert.ok(recalled.every((m) => m.score >= 0.3));
  for (let i = 1; i < recalled.length; i += 1) {
    assert.ok((recalled[i - 1]?.score ?? 0) >= (recalled[i]?.score ?? 0));
  }
  assert.ok(!recalled.some((m) => m.fact === "drop-below"));
});

test("forget removes memory for user; unknown id is no-op", async () => {
  const embedder = new FakeEmbedder().setAxis("to-forget", 5);
  const store = new SqliteMemoryStore(":memory:", embedder);
  const { id } = await store.remember("u", "to-forget");
  assert.equal(await store.forget("u", id), true);
  assert.equal((await store.recall("u", "to-forget")).length, 0);
  assert.equal(await store.forget("u", id), false);
  assert.equal(await store.forget("other", id), false);
});

test("empty fact or query is rejected", async () => {
  const embedder = new FakeEmbedder().setAxis("x", 0);
  const store = new SqliteMemoryStore(":memory:", embedder);
  await assert.rejects(() => store.remember("u", "   "), InvalidMemoryInputError);
  await assert.rejects(() => store.recall("u", ""), InvalidMemoryInputError);
});

test(
  "semantic recall finds fact without shared words (real MiniLM)",
  { timeout: 180_000 },
  async () => {
    const store = new SqliteMemoryStore(":memory:", getDefaultEmbedder());
    await store.remember(
      "semantic-user",
      "The checkout payment queue has elevated latency during peak hours",
    );
    const recalled = await store.recall(
      "semantic-user",
      "Are card charges slow at rush time?",
    );
    assert.ok(
      recalled.some((m) => /checkout payment queue/i.test(m.fact)),
      `expected semantic hit, got: ${JSON.stringify(recalled)}`,
    );
    assert.ok((recalled[0]?.score ?? 0) >= 0.3);
  },
);
