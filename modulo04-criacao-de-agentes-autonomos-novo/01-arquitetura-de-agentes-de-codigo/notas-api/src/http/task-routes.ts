import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createTaskInputSchema,
  taskIdSchema,
  taskListFilterSchema,
  taskListSchema,
  taskSchema,
} from "../domain/task.js";
import type { TaskService } from "../service/task-service.js";
import { toHttpErrorResponse } from "./http-errors.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(body));
};

const sendEmpty = (response: ServerResponse, statusCode: number): void => {
  response.writeHead(statusCode);
  response.end();
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (rawBody.length === 0) {
    return {};
  }

  return JSON.parse(rawBody) as unknown;
};

const getTaskIdFromCompletePath = (pathname: string): string | undefined => {
  const completeMatch = /^\/tasks\/([^/]+)\/complete$/.exec(pathname);

  if (completeMatch) {
    return decodeURIComponent(completeMatch[1] ?? "");
  }

  return undefined;
};

const getTaskIdFromTaskPath = (pathname: string): string | undefined => {
  const taskMatch = /^\/tasks\/([^/]+)$/.exec(pathname);

  if (taskMatch) {
    return decodeURIComponent(taskMatch[1] ?? "");
  }

  return undefined;
};

const isCompletePath = (pathname: string): boolean =>
  /^\/tasks\/[^/]+\/complete$/.test(pathname);

export const createTaskHttpHandler =
  (taskService: TaskService) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    try {
      if (request.method === "POST" && requestUrl.pathname === "/tasks") {
        const input = createTaskInputSchema.parse(await readJsonBody(request));
        const task = taskSchema.parse(taskService.createTask(input));

        sendJson(response, 201, task);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/tasks") {
        const statusParam = requestUrl.searchParams.get("status") ?? "all";
        const filter = taskListFilterSchema.parse(statusParam);
        const tasks = taskListSchema.parse(taskService.listTasks(filter));

        sendJson(response, 200, tasks);
        return;
      }

      if (request.method === "PATCH" && isCompletePath(requestUrl.pathname)) {
        const taskId = taskIdSchema.parse(
          getTaskIdFromCompletePath(requestUrl.pathname),
        );
        const task = taskSchema.parse(taskService.completeTask(taskId));

        sendJson(response, 200, task);
        return;
      }

      if (request.method === "DELETE" && getTaskIdFromTaskPath(requestUrl.pathname)) {
        const taskId = taskIdSchema.parse(getTaskIdFromTaskPath(requestUrl.pathname));

        taskService.removeTask(taskId);
        sendEmpty(response, 204);
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      const httpError = toHttpErrorResponse(error);

      sendJson(response, httpError.statusCode, httpError.body);
    }
  };
