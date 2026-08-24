import { randomUUID } from "node:crypto";

import type {
  CreateTaskInput,
  Task,
  TaskId,
  TaskListFilter,
} from "../domain/task.js";
import type { TaskStore } from "./task-store.js";

const cloneTask = (task: Task): Task => ({ ...task });

export class InMemoryTaskStore implements TaskStore {
  readonly #tasks = new Map<TaskId, Task>();
  readonly #generateId: () => TaskId;

  constructor(generateId: () => TaskId = () => randomUUID()) {
    this.#generateId = generateId;
  }

  create(input: CreateTaskInput): Task {
    const task: Task = {
      id: this.#generateId(),
      title: input.title,
      status: "open",
    };

    this.#tasks.set(task.id, task);

    return cloneTask(task);
  }

  list(filter: TaskListFilter = "all"): Task[] {
    const tasks = Array.from(this.#tasks.values());

    if (filter === "all") {
      return tasks.map(cloneTask);
    }

    return tasks.filter((task) => task.status === filter).map(cloneTask);
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

    return cloneTask(completedTask);
  }

  remove(id: TaskId): boolean {
    return this.#tasks.delete(id);
  }
}
