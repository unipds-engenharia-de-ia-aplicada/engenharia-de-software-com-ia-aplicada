import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";

import {
  createRegistry,
  listStrategies,
  resolveStrategy,
  type StrategyRegistry,
} from "../agents/index.js";
import type { ConversationSummarizer } from "../chat/history-summarizer.js";
import { runChat } from "../chat/run-chat.js";
import {
  ChatTimeoutError,
  ConversationNotFoundError,
  EmbeddingError,
  InvalidMemoryInputError,
  UnknownStrategyError,
} from "../domain/errors.js";
import type { ConversationStore, MemoryStore } from "../domain/types.js";
import type { LearningReflectorFn } from "../memory/learning-reflector.js";
import type { ReflectionOpts } from "../strategies/reflect.js";
import { chatRequestSchema, rememberRequestSchema } from "./chat-schema.js";

export interface ChatAppDeps {
  registry: StrategyRegistry;
  conversations: ConversationStore;
  memories: MemoryStore;
  timeoutMs?: number;
  reflectionOpts?: ReflectionOpts;
  learningReflector?: LearningReflectorFn;
  summarizer?: ConversationSummarizer;
}

const DEFAULT_TIMEOUT_MS = 180_000;

export { createRegistry, listStrategies, resolveStrategy };
export type { StrategyRegistry };

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChatTimeoutError(timeoutMs));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isJsonSyntaxError(error: unknown): error is SyntaxError & { status?: number } {
  return (
    error instanceof SyntaxError &&
    "status" in error &&
    (error as { status?: number }).status === 400
  );
}

export function createApp(deps: ChatAppDeps): Express {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const app = express();

  app.use(
    // Accept curl -d JSON without -H Content-Type (defaults to x-www-form-urlencoded).
    express.json({
      type: (req) => {
        const ct = req.headers["content-type"] ?? "";
        return (
          ct === "" ||
          ct.includes("application/json") ||
          ct.includes("text/plain") ||
          ct.includes("application/x-www-form-urlencoded")
        );
      },
    }),
  );

  app.post("/chat", async (req, res, next) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: parsed.error.issues,
        });
        return;
      }

      const { message, strategy, reflect, conversationId, userId } = parsed.data;
      const resolved = resolveStrategy(
        deps.registry,
        strategy,
        reflect,
        deps.reflectionOpts,
      );

      const result = await runChat(
        deps.conversations,
        deps.memories,
        resolved,
        { message, conversationId, userId },
        {
          execute: (promise) => runWithTimeout(promise, timeoutMs),
          learningReflector: deps.learningReflector,
          summarizer: deps.summarizer,
        },
      );

      res.status(200).json({
        answer: result.answer,
        trace: result.trace,
        metrics: result.metrics,
        conversationId: result.conversationId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/memories", async (req, res, next) => {
    try {
      const parsed = rememberRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: parsed.error.issues,
        });
        return;
      }

      const { userId, fact } = parsed.data;
      const result = await deps.memories.remember(userId, fact);
      res.status(result.stored ? 201 : 200).json({
        id: result.id,
        stored: result.stored,
        userId,
        fact: fact.trim(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "validation_error",
        issues: error.issues,
      });
      return;
    }

    if (isJsonSyntaxError(error)) {
      res.status(400).json({
        error: "validation_error",
        issues: [
          {
            code: "custom",
            message: "Invalid JSON",
            path: [],
          },
        ],
      });
      return;
    }

    if (error instanceof UnknownStrategyError) {
      res.status(422).json({
        error: "unknown_strategy",
        strategy: error.strategy,
      });
      return;
    }

    if (error instanceof ConversationNotFoundError) {
      res.status(404).json({
        error: "conversation_not_found",
        conversationId: error.conversationId,
      });
      return;
    }

    if (error instanceof EmbeddingError) {
      res.status(500).json({
        error: "internal_error",
        message: error.message,
      });
      return;
    }

    if (error instanceof InvalidMemoryInputError) {
      res.status(400).json({
        error: "validation_error",
        message: error.message,
      });
      return;
    }

    if (error instanceof ChatTimeoutError) {
      res.status(504).json({
        error: "timeout",
        message: error.message,
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "internal_error",
      message,
    });
  });

  return app;
}

export function startServer(app: Express, port: number) {
  return app.listen(port, () => {
    console.log(`OpsPilot chat listening on http://localhost:${port}`);
  });
}
