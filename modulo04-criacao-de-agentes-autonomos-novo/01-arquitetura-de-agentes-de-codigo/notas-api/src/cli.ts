import { createTaskApp } from "./factories/task-app.js";
import { runTaskCli } from "./cli/commands.js";
import { JsonFileTaskStore, TaskStorePersistenceError } from "./store/json-file-task-store.js";

const cliStorePath =
  process.env.TASK_CLI_STORE_PATH ?? `${process.cwd()}/.tasks-cli-store.json`;

try {
  const { taskService } = createTaskApp(new JsonFileTaskStore(cliStorePath));
  process.exitCode = runTaskCli(process.argv.slice(2), taskService, {
    stdout: process.stdout,
    stderr: process.stderr,
  });
} catch (error) {
  if (error instanceof TaskStorePersistenceError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
