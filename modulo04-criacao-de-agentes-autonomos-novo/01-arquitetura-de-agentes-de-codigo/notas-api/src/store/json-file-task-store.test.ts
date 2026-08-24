import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { JsonFileTaskStore, TaskStorePersistenceError } from "./json-file-task-store.js";

const createTempDir = (): string => mkdtempSync(join(tmpdir(), "json-task-store-"));

test("starts empty when file does not exist", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    const store = new JsonFileTaskStore(filePath);

    assert.deepEqual(store.list(), []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("starts empty when file exists but is empty", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    writeFileSync(filePath, "");

    const store = new JsonFileTaskStore(filePath);

    assert.deepEqual(store.list(), []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loads tasks from an existing JSON file", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        tasks: [{ id: "1", title: "Buy milk", status: "open" }],
      }),
    );

    const store = new JsonFileTaskStore(filePath);

    assert.deepEqual(store.list(), [{ id: "1", title: "Buy milk", status: "open" }]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("persists create/complete/remove across store instances", () => {
  const tempDir = createTempDir();
  const filePath = join(tempDir, "tasks.json");

  try {
    const firstStore = new JsonFileTaskStore(filePath, {
      generateId: (() => {
        let nextId = 1;
        return () => `${nextId++}`;
      })(),
    });

    const created = firstStore.create({ title: "Buy milk" });
    assert.deepEqual(created, { id: "1", title: "Buy milk", status: "open" });

    const secondStore = new JsonFileTaskStore(filePath);
    assert.deepEqual(secondStore.list(), [{ id: "1", title: "Buy milk", status: "open" }]);

    const completed = secondStore.complete("1");
    assert.deepEqual(completed, { id: "1", title: "Buy milk", status: "done" });

    const thirdStore = new JsonFileTaskStore(filePath);
    assert.deepEqual(thirdStore.list("done"), [{ id: "1", title: "Buy milk", status: "done" }]);

    assert.equal(thirdStore.remove("1"), true);

    const fourthStore = new JsonFileTaskStore(filePath);
    assert.deepEqual(fourthStore.list(), []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("throws a persistence error for invalid JSON", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    writeFileSync(filePath, "{ invalid json }");

    assert.throws(
      () => new JsonFileTaskStore(filePath),
      (error: unknown) =>
        error instanceof TaskStorePersistenceError &&
        error.message.includes("contains invalid JSON"),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("throws a persistence error for invalid file structure", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    writeFileSync(filePath, JSON.stringify({ tasks: [{ id: 1 }] }));

    assert.throws(
      () => new JsonFileTaskStore(filePath),
      (error: unknown) =>
        error instanceof TaskStorePersistenceError &&
        error.message.includes("invalid structure"),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("throws a persistence error when reading from an unreadable path", () => {
  const tempDir = createTempDir();

  try {
    const directoryPath = join(tempDir, "tasks-dir");
    mkdirSync(directoryPath);

    assert.throws(
      () => new JsonFileTaskStore(directoryPath),
      (error: unknown) =>
        error instanceof TaskStorePersistenceError &&
        error.message.includes("Failed to read"),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("throws a persistence error when write path cannot be created", () => {
  const invalidFilePath = "/dev/null/tasks.json";
  const store = new JsonFileTaskStore(invalidFilePath, { generateId: () => "1" });

  assert.throws(
    () => store.create({ title: "Buy milk" }),
    (error: unknown) =>
      error instanceof TaskStorePersistenceError &&
      error.message.includes("Failed to persist"),
  );
});

test("writes tasks using the expected JSON envelope", () => {
  const tempDir = createTempDir();

  try {
    const filePath = join(tempDir, "tasks.json");
    const store = new JsonFileTaskStore(filePath, { generateId: () => "1" });

    store.create({ title: "Buy milk" });

    const persistedContent = JSON.parse(readFileSync(filePath, "utf8")) as {
      tasks: unknown[];
    };

    assert.deepEqual(persistedContent, {
      tasks: [{ id: "1", title: "Buy milk", status: "open" }],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
