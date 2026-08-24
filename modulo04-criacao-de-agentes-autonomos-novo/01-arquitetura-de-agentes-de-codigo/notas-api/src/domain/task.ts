import { z } from "zod";

export const taskIdSchema = z.string().trim().min(1, "Task id is required");
export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Task title is required");
export const taskStatusSchema = z.enum(["open", "done"]);
export const taskListFilterSchema = z.enum(["all", "open", "done"]);

export const createTaskInputSchema = z.object({
  title: taskTitleSchema,
});

export const taskSchema = z.object({
  id: taskIdSchema,
  title: taskTitleSchema,
  status: taskStatusSchema,
});

export const taskListSchema = z.array(taskSchema);

export type TaskId = z.infer<typeof taskIdSchema>;
export type TaskTitle = z.infer<typeof taskTitleSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskListFilter = z.infer<typeof taskListFilterSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type Task = z.infer<typeof taskSchema>;
