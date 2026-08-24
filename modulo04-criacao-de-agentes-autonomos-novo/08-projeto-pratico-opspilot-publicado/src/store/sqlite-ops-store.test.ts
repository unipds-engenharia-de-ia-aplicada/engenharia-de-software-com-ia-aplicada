import test from "node:test";
import assert from "node:assert/strict";

import { IncidentNotFoundError } from "../domain/errors.js";
import { seedOpsStore } from "./seed.js";
import { SqliteOpsStore } from "./sqlite-ops-store.js";

function memoryStore(): SqliteOpsStore {
  const store = new SqliteOpsStore(":memory:");
  seedOpsStore(store);
  return store;
}

test("seed idempotent: 5 services, 6 alerts (3/3), 3 runbooks", () => {
  const store = new SqliteOpsStore(":memory:");
  seedOpsStore(store);
  seedOpsStore(store);

  const { services, alerts, runbooks } = store.counts();
  assert.equal(services, 5);
  assert.equal(alerts, 6);
  assert.equal(runbooks, 3);
  assert.equal(store.getAlerts("firing").length, 3);
  assert.equal(store.getAlerts("resolved").length, 3);
});

test("create → getIncidents(open) → resolve → getIncidents(resolved)", () => {
  const store = memoryStore();
  const created = store.createIncident({
    title: "Checkout outage",
    service: "checkout",
    severity: "critical",
  });
  assert.equal(store.getIncidents("open").length, 1);
  assert.equal(store.getIncidents("resolved").length, 0);

  const resolved = store.resolveIncident(created.id, "mitigated via rollback");
  assert.equal(resolved.status, "resolved");
  assert.ok(typeof resolved.resolvedAt === "number");
  assert.equal(resolved.summary, "mitigated via rollback");
  assert.equal(store.getIncidents("open").length, 0);
  assert.equal(store.getIncidents("resolved").length, 1);
  assert.equal(store.getIncidents().length, 1);
});

test("getAlerts filters firing / resolved / all", () => {
  const store = memoryStore();
  assert.equal(store.getAlerts().length, 6);
  assert.equal(store.getAlerts("firing").length, 3);
  assert.equal(store.getAlerts("resolved").length, 3);
});

test("resolveIncident unknown id throws", () => {
  const store = memoryStore();
  assert.throws(() => store.resolveIncident("inc-missing"), IncidentNotFoundError);
});

test("CHECK rejects invalid tier / severity / status", () => {
  const store = new SqliteOpsStore(":memory:");

  assert.throws(() => {
    store.database.prepare(`INSERT INTO services (name, tier) VALUES (?, ?)`).run("x", "invalid-tier");
  });

  assert.throws(() => {
    store.database
      .prepare(
        `INSERT INTO alerts (id, service, description, severity, status) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("a1", "checkout", "bad", "ultra", "firing");
  });

  assert.throws(() => {
    store.database
      .prepare(
        `INSERT INTO incidents (id, title, service, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("i1", "t", "checkout", "critical", "mitigated", Date.now());
  });
});

test("bench entrypoint stays on InMemoryStore (not SqliteOpsStore)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const benchPath = fileURLToPath(new URL("../bench.ts", import.meta.url));
  const src = readFileSync(benchPath, "utf8");
  assert.match(src, /new InMemoryStore\(/);
  assert.match(src, /seedOpsStore/);
  assert.doesNotMatch(src, /SqliteOpsStore/);
});
