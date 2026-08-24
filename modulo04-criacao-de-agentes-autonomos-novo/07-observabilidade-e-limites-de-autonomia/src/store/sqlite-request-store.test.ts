import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TraceEvent } from "../domain/types.js";
import { SqliteRequestStore } from "./sqlite-request-store.js";

function sampleTrace(): TraceEvent[] {
  return [
    {
      type: "route",
      node: "roteador",
      content: "simple",
      route: "react",
      override: false,
      reason: "simple",
    },
    {
      type: "thought",
      node: "react",
      content: "thinking",
      tool: "list_alerts",
      toolArgs: { status: "firing" },
    },
    { type: "answer", node: "react", content: "ok" },
  ];
}

test("save + getById preserves metrics and ordered trace", () => {
  const store = new SqliteRequestStore(":memory:");
  const id = "11111111-1111-4111-8111-111111111111";
  const trace = sampleTrace();

  store.save({
    id,
    createdAt: 1000,
    finishedAt: 2000,
    status: "success",
    httpStatus: 200,
    conversationId: "22222222-2222-4222-8222-222222222222",
    userId: "u1",
    metrics: {
      llmCalls: 2,
      latencyMs: 42,
      route: "react",
      modelUsed: "openai/gpt-4o-mini",
      promptTokens: 10,
    },
    trace,
  });

  const found = store.getById(id);
  assert.ok(found);
  assert.equal(found.request.id, id);
  assert.equal(found.request.status, "success");
  assert.equal(found.request.httpStatus, 200);
  assert.equal(found.request.userId, "u1");
  assert.equal(found.request.latencyMs, 42);
  assert.equal(found.request.llmCalls, 2);
  assert.equal(found.request.route, "react");
  assert.equal(found.request.modelUsed, "openai/gpt-4o-mini");
  assert.equal(found.request.metrics.promptTokens, 10);
  assert.equal(found.trace.length, 3);
  assert.equal(found.trace[0]?.type, "route");
  assert.equal(found.trace[1]?.tool, "list_alerts");
  assert.deepEqual(found.trace[1]?.toolArgs, { status: "firing" });
  assert.equal(found.trace[2]?.type, "answer");
});

test("empty trace and missing id", () => {
  const store = new SqliteRequestStore(":memory:");
  const id = "33333333-3333-4333-8333-333333333333";
  store.save({
    id,
    createdAt: 1,
    finishedAt: 2,
    status: "success",
    httpStatus: 200,
    metrics: { llmCalls: 0, latencyMs: 1 },
    trace: [],
  });
  const found = store.getById(id);
  assert.ok(found);
  assert.deepEqual(found.trace, []);
  assert.equal(store.getById("44444444-4444-4444-8444-444444444444"), null);
});

test("idempotent DDL on same database", () => {
  const store = new SqliteRequestStore(":memory:");
  const again = new SqliteRequestStore(":memory:");
  // Separate :memory: connections — instead re-exec DDL on same handle:
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'error')),
      http_status INTEGER NOT NULL,
      conversation_id TEXT,
      user_id TEXT,
      metrics_json TEXT NOT NULL,
      latency_ms INTEGER,
      llm_calls INTEGER,
      route TEXT,
      model_used TEXT
    );
  `);
  assert.ok(store.database);
  assert.ok(again.database);
});

test("file reopen recovers request (SC-005)", () => {
  const dir = mkdtempSync(join(tmpdir(), "opspilot-req-"));
  const path = join(dir, "audit.db");
  try {
    const id = "55555555-5555-4555-8555-555555555555";
    const first = new SqliteRequestStore(path);
    first.save({
      id,
      createdAt: 10,
      finishedAt: 20,
      status: "success",
      httpStatus: 200,
      userId: "plantao",
      metrics: { llmCalls: 1, latencyMs: 5, route: "react", modelUsed: "m" },
      trace: [{ type: "answer", node: "react", content: "hi" }],
    });
    // Close by dropping reference; open new connection on same file.
    const second = new SqliteRequestStore(path);
    const found = second.getById(id);
    assert.ok(found);
    assert.equal(found.request.userId, "plantao");
    assert.equal(found.trace.length, 1);
    assert.equal(found.trace[0]?.content, "hi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stats aggregates total/errors/tokens/cost/p50/p95/byRoute/byModel", () => {
  const store = new SqliteRequestStore(":memory:");
  const now = Date.now();
  store.save({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: now - 1000,
    finishedAt: now,
    status: "success",
    httpStatus: 200,
    metrics: {
      llmCalls: 1,
      latencyMs: 10,
      promptTokens: 1_000_000,
      route: "react",
      modelUsed: "openai/gpt-4o-mini:free",
    },
    trace: [],
  });
  store.save({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    createdAt: now - 500,
    finishedAt: now,
    status: "error",
    httpStatus: 503,
    metrics: {
      llmCalls: 1,
      latencyMs: 50,
      promptTokens: 1_000_000,
      route: "planExecute",
      modelUsed: "openai/gpt-4o-mini",
    },
    trace: [],
  });
  store.save({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    createdAt: now - 48 * 3_600_000,
    finishedAt: now,
    status: "success",
    httpStatus: 200,
    metrics: {
      llmCalls: 1,
      latencyMs: 999,
      promptTokens: 9_000_000,
      route: "react",
      modelUsed: "old/model",
    },
    trace: [],
  });

  const summary = store.stats(now - 24 * 3_600_000);
  assert.equal(summary.total, 2);
  assert.equal(summary.errors, 1);
  assert.equal(summary.tokens, 2_000_000);
  assert.equal(summary.costUsd, 0.15); // only paid model; :free = 0
  assert.equal(summary.latency.p50, 10);
  assert.equal(summary.latency.p95, 50);
  assert.equal(summary.byRoute.react?.total, 1);
  assert.equal(summary.byRoute.planExecute?.errors, 1);
  assert.equal(summary.byModel["openai/gpt-4o-mini:free"]?.costUsd, 0);
  assert.equal(summary.byModel["openai/gpt-4o-mini"]?.costUsd, 0.15);
});
