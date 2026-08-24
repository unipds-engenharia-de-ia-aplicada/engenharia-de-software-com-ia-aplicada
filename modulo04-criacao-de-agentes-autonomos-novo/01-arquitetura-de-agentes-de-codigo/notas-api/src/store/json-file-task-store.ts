import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { ZodError, z } from "zod";

import { taskListSchema, type CreateTaskInput, type Task, type TaskId, type TaskListFilter } from "../domain/task.js";
import type { TaskStore } from "./task-store.js";

const fileTaskStoreSchema = z.object({
  tasks: taskListSchema,
});

class TaskStorePersistenceError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "TaskStorePersistenceError";
    this.cause = cause;
  }
}

const cloneTask = (task: Task): Task => ({ ...task });

const toTaskMap = (tasks: Task[]): Map<TaskId, Task> =>
  new Map(tasks.map((task) => [task.id, cloneTask(task)]));

const toTaskArray = (tasks: Map<TaskId, Task>): Task[] =>
  Array.from(tasks.values(), cloneTask);

export interface JsonFileTaskStoreOptions {
  generateId?: () => TaskId;
}

export class JsonFileTaskStore implements TaskStore {
  readonly #filePath: string;
  readonly #tasks: Map<TaskId, Task>;
  readonly #generateId: () => TaskId;

  constructor(filePath: string, options: JsonFileTaskStoreOptions = {}) {
    this.#filePath = filePath;
    this.#generateId = options.generateId ?? (() => randomUUID());
    this.#tasks = this.#loadTasksFromFile(filePath);
  }

  create(input: CreateTaskInput): Task {
    const task: Task = {
      id: this.#generateId(),
      title: input.title,
      status: "open",
    };

    this.#tasks.set(task.id, task);
    this.#persistTasks();
    return cloneTask(task);
  }

  list(filter: TaskListFilter = "all"): Task[] {
    const tasks = toTaskArray(this.#tasks);

    if (filter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === filter);
  }

  getById(id: TaskId): Task | undefined {
    const task = this.#tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  complete(id: TaskId): Task | undefined {
    const task = this.#tasks.get(id);

    if (!task) {
      return undefined;
    }

    const completedTask =
      task.status === "done" ? task : { ...task, status: "done" as const };
    this.#tasks.set(id, completedTask);
    this.#persistTasks();

    return cloneTask(completedTask);
  }

  remove(id: TaskId): boolean {
    const removed = this.#tasks.delete(id);

    if (!removed) {
      return false;
    }

    this.#persistTasks();
    return true;
  }

  #loadTasksFromFile(filePath: string): Map<TaskId, Task> {
    if (!existsSync(filePath)) {
      return new Map();
    }

    let rawContent: string;
    try {
      rawContent = readFileSync(filePath, "utf8");
    } catch (error) {
      throw new TaskStorePersistenceError(
        `Failed to read task store file at "${filePath}"`,
        error,
      );
    }

    if (rawContent.trim().length === 0) {
      return new Map();
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (error) {
      throw new TaskStorePersistenceError(
        `Task store file at "${filePath}" contains invalid JSON`,
        error,
      );
    }

    try {
      const parsedStore = fileTaskStoreSchema.parse(parsedContent);
      return toTaskMap(parsedStore.tasks);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new TaskStorePersistenceError(
          `Task store file at "${filePath}" has an invalid structure`,
          error,
        );
      }

      throw error;
    }
  }

  #persistTasks(): void {
    const directory = dirname(this.#filePath);
    const tempFilePath = `${this.#filePath}.${process.pid}.${Date.now()}.tmp`;
    const fileContent = JSON.stringify(
      {
        tasks: toTaskArray(this.#tasks),
      },
      null,
      2,
    );

    try {
      mkdirSync(directory, { recursive: true });
      writeFileSync(tempFilePath, `${fileContent}\n`, "utf8");
      renameSync(tempFilePath, this.#filePath);
    } catch (error) {
      throw new TaskStorePersistenceError(
        `Failed to persist task store file at "${this.#filePath}"`,
        error,
      );
    }
  }
}

export { TaskStorePersistenceError };
