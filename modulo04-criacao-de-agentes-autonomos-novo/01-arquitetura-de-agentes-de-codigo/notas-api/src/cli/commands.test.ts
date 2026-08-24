import assert from "node:assert/strict";
import test from "node:test";

import { createTaskApp } from "../factories/task-app.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import { TaskStorePersistenceError } from "../store/json-file-task-store.js";
import { runTaskCli } from "./commands.js";

const createIo = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    io: {
      stdout: {
        write(message: string) {
          stdout.push(message);
        },
      },
      stderr: {
        write(message: string) {
          stderr.push(message);
        },
      },
    },
  };
};

const createTaskService = () => {
  let nextId = 1;

  return createTaskApp(new InMemoryTaskStore(() => `${nextId++}`)).taskService;
};

test("task create prints confirmation and exits with success", () => {
  const taskService = createTaskService();
  const { io, stdout, stderr } = createIo();

  const exitCode = runTaskCli(
    ["task", "create", "--title", "Buy milk"],
    taskService,
    io,
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, ["Created task: 1\topen\tBuy milk\n"]);
  assert.deepEqual(stderr, []);
});

test("task list prints tasks filtered by status", () => {
  const taskService = createTaskService();
  const { io, stdout, stderr } = createIo();

  taskService.createTask({ title: "Buy milk" });
  taskService.createTask({ title: "Walk dog" });
  taskService.completeTask("2");

  const exitCode = runTaskCli(["task", "list", "--status", "done"], taskService, io);

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, ["2\tdone\tWalk dog\n"]);
  assert.deepEqual(stderr, []);
});

test("task complete prints confirmation and exits with success", () => {
  const taskService = createTaskService();
  const { io, stdout, stderr } = createIo();

  taskService.createTask({ title: "Buy milk" });

  const exitCode = runTaskCli(["task", "complete", "--id", "1"], taskService, io);

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, ["Completed task: 1\tdone\tBuy milk\n"]);
  assert.deepEqual(stderr, []);
});

test("task remove prints confirmation and exits with success", () => {
  const taskService = createTaskService();
  const { io, stdout, stderr } = createIo();

  taskService.createTask({ title: "Buy milk" });

  const exitCode = runTaskCli(["task", "remove", "--id", "1"], taskService, io);

  assert.equal(exitCode, 0);
  assert.deepEqual(stdout, ["Removed task: 1\n"]);
  assert.deepEqual(stderr, []);
});

test("invalid CLI input prints a readable error and exits non-zero", () => {
  const taskService = createTaskService();
  const { io, stdout, stderr } = createIo();

  const exitCode = runTaskCli(
    ["task", "list", "--status", "invalid"],
    taskService,
    io,
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join(""), /Validation failed|Invalid option|Invalid input/i);
  assert.match(stderr.join(""), /task list \[--status all\|open\|done\]/);
});

test("store persistence error prints message and exits non-zero", () => {
  const taskService = {
    createTask() {
      throw new TaskStorePersistenceError("Failed to persist task store file", new Error("IO"));
    },
    listTasks() {
      return [];
    },
    completeTask() {
      throw new Error("not used");
    },
    removeTask() {
      throw new Error("not used");
    },
  };
  const { io, stdout, stderr } = createIo();

  const exitCode = runTaskCli(
    ["task", "create", "--title", "Buy milk"],
    taskService,
    io,
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join(""), /Failed to persist task store file/);
});
