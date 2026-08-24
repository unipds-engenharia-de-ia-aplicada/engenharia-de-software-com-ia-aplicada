import { ZodError } from "zod";

import {
  taskIdSchema,
  taskListFilterSchema,
  taskTitleSchema,
  type Task,
  type TaskId,
  type TaskListFilter,
  type TaskTitle,
} from "../domain/task.js";
import { TaskNotFoundError, TaskValidationError } from "../service/task-errors.js";
import type { TaskService } from "../service/task-service.js";
import { TaskStorePersistenceError } from "../store/json-file-task-store.js";

export interface CliIO {
  stdout: { write(message: string): void };
  stderr: { write(message: string): void };
}

type CliCommand =
  | { kind: "create"; title: TaskTitle }
  | { kind: "list"; status?: TaskListFilter }
  | { kind: "complete"; id: TaskId }
  | { kind: "remove"; id: TaskId };

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

const usage = [
  "Usage:",
  "  task create --title <title>",
  "  task list [--status all|open|done]",
  "  task complete --id <task-id>",
  "  task remove --id <task-id>",
].join("\n");

const writeLine = (
  stream: { write(message: string): void },
  message: string,
): void => {
  stream.write(`${message}\n`);
};

const formatTask = (task: Task): string =>
  `${task.id}\t${task.status}\t${task.title}`;

const parseFlagValue = (
  args: string[],
  flagName: string,
  commandName: string,
): string => {
  const flagIndex = args.indexOf(flagName);

  if (flagIndex === -1) {
    throw new CliUsageError(
      `Missing required flag ${flagName} for command "${commandName}"`,
    );
  }

  const value = args[flagIndex + 1];

  if (!value || value.startsWith("--")) {
    throw new CliUsageError(
      `Missing value for flag ${flagName} in command "${commandName}"`,
    );
  }

  if (args.length !== flagIndex + 2) {
    throw new CliUsageError(`Unexpected extra arguments for command "${commandName}"`);
  }

  return value;
};

const parseOptionalFlagValue = (
  args: string[],
  flagName: string,
  commandName: string,
): string | undefined => {
  if (args.length === 0) {
    return undefined;
  }

  const flagIndex = args.indexOf(flagName);

  if (flagIndex === -1 || flagIndex !== 0 || args.length !== 2) {
    throw new CliUsageError(`Invalid arguments for command "${commandName}"`);
  }

  const value = args[1];

  if (!value || value.startsWith("--")) {
    throw new CliUsageError(
      `Missing value for flag ${flagName} in command "${commandName}"`,
    );
  }

  return value;
};

const parseCliCommand = (argv: string[]): CliCommand => {
  const args = argv[0] === "task" ? argv.slice(1) : argv;
  const [commandName, ...commandArgs] = args;

  if (!commandName) {
    throw new CliUsageError("Missing command");
  }

  switch (commandName) {
    case "create":
      return {
        kind: "create",
        title: taskTitleSchema.parse(parseFlagValue(commandArgs, "--title", "create")),
      };
    case "list":
      return {
        kind: "list",
        status: (() => {
          const status = parseOptionalFlagValue(commandArgs, "--status", "list");
          return status === undefined ? undefined : taskListFilterSchema.parse(status);
        })(),
      };
    case "complete":
      return {
        kind: "complete",
        id: taskIdSchema.parse(parseFlagValue(commandArgs, "--id", "complete")),
      };
    case "remove":
      return {
        kind: "remove",
        id: taskIdSchema.parse(parseFlagValue(commandArgs, "--id", "remove")),
      };
    default:
      throw new CliUsageError(`Unknown command "${commandName}"`);
  }
};

export const runTaskCli = (
  argv: string[],
  taskService: TaskService,
  io: CliIO,
): number => {
  try {
    const command = parseCliCommand(argv);

    switch (command.kind) {
      case "create": {
        const task = taskService.createTask({ title: command.title });
        writeLine(io.stdout, `Created task: ${formatTask(task)}`);
        return 0;
      }
      case "list": {
        const tasks = taskService.listTasks(command.status);

        if (tasks.length === 0) {
          writeLine(io.stdout, "No tasks found.");
          return 0;
        }

        for (const task of tasks) {
          writeLine(io.stdout, formatTask(task));
        }

        return 0;
      }
      case "complete": {
        const task = taskService.completeTask(command.id);
        writeLine(io.stdout, `Completed task: ${formatTask(task)}`);
        return 0;
      }
      case "remove": {
        taskService.removeTask(command.id);
        writeLine(io.stdout, `Removed task: ${command.id}`);
        return 0;
      }
    }
  } catch (error) {
    if (
      error instanceof CliUsageError ||
      error instanceof TaskValidationError ||
      error instanceof TaskNotFoundError
    ) {
      writeLine(io.stderr, error.message);
      writeLine(io.stderr, usage);
      return 1;
    }

    if (error instanceof TaskStorePersistenceError) {
      writeLine(io.stderr, error.message);
      return 1;
    }

    if (error instanceof ZodError) {
      const validationError = new TaskValidationError(
        error.issues
          .map((issue) => issue.message)
          .filter((issue) => issue.length > 0),
      );
      writeLine(io.stderr, validationError.message);
      writeLine(io.stderr, usage);
      return 1;
    }

    throw error;
  }
};
