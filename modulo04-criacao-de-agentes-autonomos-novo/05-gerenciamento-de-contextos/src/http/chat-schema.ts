import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  userId: z.string().min(1),
  strategy: z.string().default("react"),
  reflect: z.boolean().default(false),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const rememberRequestSchema = z.object({
  userId: z.string().min(1),
  fact: z.string().min(1),
});

export type RememberRequest = z.infer<typeof rememberRequestSchema>;
