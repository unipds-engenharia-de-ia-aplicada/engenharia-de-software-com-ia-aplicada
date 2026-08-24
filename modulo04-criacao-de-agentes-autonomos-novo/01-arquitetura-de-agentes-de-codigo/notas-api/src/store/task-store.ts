import type { CreateTaskInput, Task, TaskId, TaskListFilter } from "../domain/task.js";

export interface TaskStore {
  create(input: CreateTaskInput): Task;
  list(filter?: TaskListFilter): Task[];
  getById(id: TaskId): Task | undefined;
  complete(id: TaskId): Task | undefined;
  remove(id: TaskId): boolean;
}
