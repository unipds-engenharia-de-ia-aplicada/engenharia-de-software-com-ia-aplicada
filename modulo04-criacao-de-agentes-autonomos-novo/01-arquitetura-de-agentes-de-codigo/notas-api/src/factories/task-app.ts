import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import type { TaskStore } from "../store/task-store.js";
import { createTaskHttpHandler } from "../http/task-routes.js";
import { createTaskService, type TaskService } from "../service/task-service.js";

export interface TaskApp {
  taskService: TaskService;
  taskStore: TaskStore;
  httpHandler: ReturnType<typeof createTaskHttpHandler>;
}

export const createTaskApp = (taskStore: TaskStore = new InMemoryTaskStore()): TaskApp => {
  const taskService = createTaskService(taskStore);

  return {
    taskService,
    taskStore,
    httpHandler: createTaskHttpHandler(taskService),
  };
};
