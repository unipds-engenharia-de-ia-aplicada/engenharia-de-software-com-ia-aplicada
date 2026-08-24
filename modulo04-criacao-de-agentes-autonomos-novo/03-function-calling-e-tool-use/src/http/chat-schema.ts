import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  strategy: z.string().default("react"),
  reflect: z.boolean().default(false),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
