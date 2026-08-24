import test from "node:test";
import assert from "node:assert/strict";

import { IncidentNotFoundError } from "../domain/errors.js";
import { InMemoryStore } from "./in-memory-store.js";
import { seedStore } from "./seed.js";

test("getAlerts returns all 6 seeded alerts", () => {
  const store = new InMemoryStore();
  seedStore(store);
  assert.equal(store.getAlerts().length, 6);
});

test("getAlerts('firing') returns exactly 3", () => {
  const store = new InMemoryStore();
  seedStore(store);
  assert.equal(store.getAlerts("firing").length, 3);
});

test("getAlerts('resolved') returns exactly 3", () => {
  const store = new InMemoryStore();
  seedStore(store);
  assert.equal(store.getAlerts("resolved").length, 3);
});

test("createIncident generates unique ids", () => {
  const store = new InMemoryStore();
  seedStore(store);
  const first = store.createIncident({
    title: "High error rate",
    service: "payment-api",
    severity: "critical",
  });
  const second = store.createIncident({
    title: "Another issue",
    service: "auth-service",
    severity: "high",
  });
  assert.notEqual(first.id, second.id);
  assert.equal(first.status, "open");
  assert.equal(second.status, "open");
});

test("resolveIncident transitions status to resolved", () => {
  const store = new InMemoryStore();
  seedStore(store);
  const created = store.createIncident({
    title: "Need mitigation",
    service: "order-service",
    severity: "critical",
  });
  const resolved = store.resolveIncident(created.id);
  assert.equal(resolved.status, "resolved");
  assert.ok(typeof resolved.resolvedAt === "number");
});

test("resolveIncident throws IncidentNotFoundError for unknown id", () => {
  const store = new InMemoryStore();
  seedStore(store);
  assert.throws(() => store.resolveIncident("inc-unknown"), IncidentNotFoundError);
});
