import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import { TaskNotFoundError, TaskValidationError } from "./task-errors.js";
import { createTaskService } from "./task-service.js";

test("createTask creates a task with open status", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  const task = service.createTask({ title: "Buy milk" });

  assert.deepEqual(task, {
    id: "task-1",
    title: "Buy milk",
    status: "open",
  });
});

test("createTask rejects an invalid title", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  assert.throws(
    () => service.createTask({ title: "   " }),
    (error: unknown) =>
      error instanceof TaskValidationError &&
      error.issues.includes("Task title is required"),
  );
});

test("listTasks returns all tasks when no filter is provided", () => {
  let nextId = 1;
  const service = createTaskService(
    new InMemoryTaskStore(() => `task-${nextId++}`),
  );

  service.createTask({ title: "Buy milk" });
  service.createTask({ title: "Walk dog" });

  assert.deepEqual(service.listTasks(), [
    { id: "task-1", title: "Buy milk", status: "open" },
    { id: "task-2", title: "Walk dog", status: "open" },
  ]);
});

test("listTasks filters open and done tasks", () => {
  let nextId = 1;
  const service = createTaskService(
    new InMemoryTaskStore(() => `task-${nextId++}`),
  );

  service.createTask({ title: "Buy milk" });
  service.createTask({ title: "Walk dog" });
  service.completeTask("task-2");

  assert.deepEqual(service.listTasks("open"), [
    { id: "task-1", title: "Buy milk", status: "open" },
  ]);
  assert.deepEqual(service.listTasks("done"), [
    { id: "task-2", title: "Walk dog", status: "done" },
  ]);
});

test("listTasks rejects an invalid filter", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  assert.throws(
    () => service.listTasks("invalid-filter" as never),
    (error: unknown) =>
      error instanceof TaskValidationError && error.issues.length > 0,
  );
});

test("completeTask is idempotent for an already done task", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  service.createTask({ title: "Buy milk" });

  const first = service.completeTask("task-1");
  const second = service.completeTask("task-1");

  assert.deepEqual(first, {
    id: "task-1",
    title: "Buy milk",
    status: "done",
  });
  assert.deepEqual(second, first);
});

test("completeTask fails for an unknown id", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  assert.throws(
    () => service.completeTask("missing-task"),
    (error: unknown) =>
      error instanceof TaskNotFoundError && error.taskId === "missing-task",
  );
});

test("removeTask deletes an existing task", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  service.createTask({ title: "Buy milk" });
  service.removeTask("task-1");

  assert.deepEqual(service.listTasks(), []);
});

test("removeTask fails for an unknown id", () => {
  const service = createTaskService(new InMemoryTaskStore(() => "task-1"));

  assert.throws(
    () => service.removeTask("missing-task"),
    (error: unknown) =>
      error instanceof TaskNotFoundError && error.taskId === "missing-task",
  );
});
