import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskInputSchema,
  taskListFilterSchema,
  taskSchema,
} from "./task.js";

test("createTaskInputSchema trims and accepts a valid title", () => {
  const input = createTaskInputSchema.parse({ title: "  Buy milk  " });

  assert.deepEqual(input, { title: "Buy milk" });
});

test("createTaskInputSchema rejects a blank title", () => {
  assert.throws(
    () => createTaskInputSchema.parse({ title: "   " }),
    /Task title is required/,
  );
});

test("taskListFilterSchema accepts all supported filters", () => {
  assert.equal(taskListFilterSchema.parse("all"), "all");
  assert.equal(taskListFilterSchema.parse("open"), "open");
  assert.equal(taskListFilterSchema.parse("done"), "done");
});

test("taskSchema parses a valid task", () => {
  const task = taskSchema.parse({
    id: "task-1",
    title: "Buy milk",
    status: "open",
  });

  assert.deepEqual(task, {
    id: "task-1",
    title: "Buy milk",
    status: "open",
  });
});
