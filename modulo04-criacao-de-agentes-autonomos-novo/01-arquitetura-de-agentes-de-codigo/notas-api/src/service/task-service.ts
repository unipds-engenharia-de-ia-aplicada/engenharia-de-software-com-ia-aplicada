import { ZodError } from "zod";

import {
  createTaskInputSchema,
  taskIdSchema,
  taskListFilterSchema,
  type CreateTaskInput,
  type Task,
  type TaskId,
  type TaskListFilter,
} from "../domain/task.js";
import type { TaskStore } from "../store/task-store.js";
import { TaskNotFoundError, TaskValidationError } from "./task-errors.js";

export interface TaskService {
  createTask(input: CreateTaskInput): Task;
  listTasks(filter?: TaskListFilter): Task[];
  completeTask(id: TaskId): Task;
  removeTask(id: TaskId): void;
}

const toValidationError = (error: ZodError): TaskValidationError =>
  new TaskValidationError(error.issues.map((issue) => issue.message));

export const createTaskService = (store: TaskStore): TaskService => ({
  createTask(input) {
    try {
      const parsedInput = createTaskInputSchema.parse(input);

      return store.create(parsedInput);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  },

  listTasks(filter = "all") {
    try {
      const parsedFilter = taskListFilterSchema.parse(filter);

      return store.list(parsedFilter);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  },

  completeTask(id) {
    let parsedId: TaskId;

    try {
      parsedId = taskIdSchema.parse(id);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }

    const task = store.complete(parsedId);

    if (!task) {
      throw new TaskNotFoundError(parsedId);
    }

    return task;
  },

  removeTask(id) {
    let parsedId: TaskId;

    try {
      parsedId = taskIdSchema.parse(id);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }

    const removed = store.remove(parsedId);

    if (!removed) {
      throw new TaskNotFoundError(parsedId);
    }
  },
});
