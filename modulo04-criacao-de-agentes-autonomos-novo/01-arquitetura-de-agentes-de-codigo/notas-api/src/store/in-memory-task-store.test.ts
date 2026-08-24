import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTaskStore } from "./in-memory-task-store.js";

test("create stores a task with generated id and open status", () => {
  const store = new InMemoryTaskStore(() => "task-1");

  const task = store.create({ title: "Buy milk" });

  assert.deepEqual(task, {
    id: "task-1",
    title: "Buy milk",
    status: "open",
  });
});

test("list returns all stored tasks by default", () => {
  let nextId = 1;
  const store = new InMemoryTaskStore(() => `task-${nextId++}`);

  store.create({ title: "Buy milk" });
  store.create({ title: "Walk dog" });

  assert.deepEqual(store.list(), [
    { id: "task-1", title: "Buy milk", status: "open" },
    { id: "task-2", title: "Walk dog", status: "open" },
  ]);
});

test("list filters tasks by status", () => {
  let nextId = 1;
  const store = new InMemoryTaskStore(() => `task-${nextId++}`);

  store.create({ title: "Buy milk" });
  store.create({ title: "Walk dog" });
  store.complete("task-2");

  assert.deepEqual(store.list("open"), [
    { id: "task-1", title: "Buy milk", status: "open" },
  ]);
  assert.deepEqual(store.list("done"), [
    { id: "task-2", title: "Walk dog", status: "done" },
  ]);
});

test("complete marks an open task as done and is idempotent", () => {
  const store = new InMemoryTaskStore(() => "task-1");

  store.create({ title: "Buy milk" });

  const firstCompletion = store.complete("task-1");
  const secondCompletion = store.complete("task-1");

  assert.deepEqual(firstCompletion, {
    id: "task-1",
    title: "Buy milk",
    status: "done",
  });
  assert.deepEqual(secondCompletion, {
    id: "task-1",
    title: "Buy milk",
    status: "done",
  });
});

test("remove deletes a task and it no longer appears in listings", () => {
  const store = new InMemoryTaskStore(() => "task-1");

  store.create({ title: "Buy milk" });

  assert.equal(store.remove("task-1"), true);
  assert.deepEqual(store.list(), []);
  assert.equal(store.getById("task-1"), undefined);
});
