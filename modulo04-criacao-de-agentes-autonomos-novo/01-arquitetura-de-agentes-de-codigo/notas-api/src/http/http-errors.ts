import { ZodError } from "zod";

import { TaskNotFoundError, TaskValidationError } from "../service/task-errors.js";

export interface HttpErrorResponse {
  statusCode: number;
  body: {
    error: string;
    issues?: string[];
  };
}

export const toHttpErrorResponse = (error: unknown): HttpErrorResponse => {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: "Validation failed",
        issues: error.issues.map((issue) => issue.message),
      },
    };
  }

  if (error instanceof TaskValidationError) {
    return {
      statusCode: 400,
      body: {
        error: "Validation failed",
        issues: error.issues,
      },
    };
  }

  if (error instanceof TaskNotFoundError) {
    return {
      statusCode: 404,
      body: {
        error: error.message,
      },
    };
  }

  if (error instanceof SyntaxError) {
    return {
      statusCode: 400,
      body: {
        error: "Invalid JSON body",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "Internal server error",
    },
  };
};
