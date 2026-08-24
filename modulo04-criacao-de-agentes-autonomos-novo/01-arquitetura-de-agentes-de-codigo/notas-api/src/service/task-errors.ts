export class TaskNotFoundError extends Error {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Task "${taskId}" was not found`);
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
  }
}

export class TaskValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "TaskValidationError";
    this.issues = issues;
  }
}
