import { z } from "zod";

import { PRODUCTION_ROUTES } from "../graph/router.js";

/** Accept graph routes + legacy plan-and-execute alias. */
const strategyField = z
  .string()
  .optional()
  .refine(
    (value) =>
      value === undefined ||
      (PRODUCTION_ROUTES as readonly string[]).includes(value) ||
      value === "plan-and-execute",
    { message: "unknown strategy" },
  );

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  userId: z.string().min(1),
  strategy: strategyField,
  reflect: z.boolean().default(false),
  conversationId: z.string().uuid().optional(),
  awaitHumanApproval: z.boolean().default(false),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const rememberRequestSchema = z.object({
  userId: z.string().min(1),
  fact: z.string().min(1),
});

export type RememberRequest = z.infer<typeof rememberRequestSchema>;

export const requestIdParamSchema = z.string().uuid();

export const approvalIdParamSchema = z.string().uuid();

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  userId: z.string().min(1),
});

export type ApprovalDecisionBody = z.infer<typeof approvalDecisionSchema>;

/** Query `since` for GET /stats — e.g. `24h`, `7d`, `30m`. Default applied in handler. */
export const statsQuerySchema = z.object({
  since: z
    .string()
    .regex(/^\d+(ms|s|m|h|d)$/i, { message: "since must look like 24h, 7d, 30m" })
    .default("24h"),
});
