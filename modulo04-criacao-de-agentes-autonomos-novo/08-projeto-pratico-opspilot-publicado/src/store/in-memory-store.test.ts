import test from "node:test";
import assert from "node:assert/strict";

import { IncidentNotFoundError, RunbookNotFoundError } from "../domain/errors.js";
import { InMemoryStore } from "./in-memory-store.js";
import { seedOpsStore } from "./seed.js";

test("getAlerts returns all 6 seeded alerts", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  assert.equal(store.getAlerts().length, 6);
});

test("getAlerts('firing') returns exactly 3", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  assert.equal(store.getAlerts("firing").length, 3);
});

test("getAlerts('resolved') returns exactly 3", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  assert.equal(store.getAlerts("resolved").length, 3);
});

test("seed is idempotent for Mercadinho PKs", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  seedOpsStore(store);
  assert.equal(store.getAlerts().length, 6);
  assert.equal(store.getRunbook("payments").service, "payments");
});

test("createIncident generates unique ids", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  const first = store.createIncident({
    title: "High error rate",
    service: "payments",
    severity: "critical",
  });
  const second = store.createIncident({
    title: "Another issue",
    service: "auth",
    severity: "high",
  });
  assert.notEqual(first.id, second.id);
  assert.equal(first.status, "open");
  assert.equal(second.status, "open");
  assert.equal(first.summary, null);
});

test("resolveIncident transitions status to resolved with summary", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  const created = store.createIncident({
    title: "Need mitigation",
    service: "checkout",
    severity: "critical",
  });
  const resolved = store.resolveIncident(created.id, "rolled back deploy");
  assert.equal(resolved.status, "resolved");
  assert.ok(typeof resolved.resolvedAt === "number");
  assert.equal(resolved.summary, "rolled back deploy");
  assert.equal(store.getIncidents("resolved").length, 1);
  assert.equal(store.getIncidents("open").length, 0);
});

test("resolveIncident throws IncidentNotFoundError for unknown id", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  assert.throws(() => store.resolveIncident("inc-unknown"), IncidentNotFoundError);
});

test("getRunbook returns Mercadinho runbook; miss throws", () => {
  const store = new InMemoryStore();
  seedOpsStore(store);
  assert.match(store.getRunbook("checkout").content, /checkout/i);
  assert.throws(() => store.getRunbook("inventory"), RunbookNotFoundError);
});
