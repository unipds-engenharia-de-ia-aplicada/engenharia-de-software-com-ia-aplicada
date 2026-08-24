import { randomUUID } from "node:crypto";
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
import type { SectionBudgets } from "../context/context-builder.js";
import {
  ChatTimeoutError,
  ConversationNotFoundError,
  EmbeddingError,
  InvalidMemoryInputError,
  ModelUnavailableError,
  ApprovalNotFoundError,
  RequestNotFoundError,
  UnknownStrategyError,
} from "../domain/errors.js";
import type {
  ApprovalStore,
  ConversationStore,
  Logger,
  MemoryStore,
  RequestStore,
} from "../domain/types.js";
import {
  runProductionTurn,
  type ProductionStrategies,
} from "../graph/production-graph.js";
import {
  parseOverrideStrategy,
  type ClassifyRouteFn,
  type ProductionRoute,
} from "../graph/router.js";
import type { LearningReflectorFn } from "../memory/learning-reflector.js";
import type { OpsChatModel } from "../agents/model.js";
import {
  approvalDecisionSchema,
  approvalIdParamSchema,
  chatRequestSchema,
  rememberRequestSchema,
  requestIdParamSchema,
  statsQuerySchema,
} from "./chat-schema.js";
import { createCorsMiddleware, resolveCorsOrigins } from "./cors.js";
import { parseSinceDuration } from "../obs/request-stats.js";
import { truncateSummary } from "../store/memory-approval-store.js";

export interface ChatAppDeps {
  conversations: ConversationStore;
  memories: MemoryStore;
  strategies: ProductionStrategies;
  /** Deterministic router for tests; production uses routeModelFactory. */
  classifyRoute?: ClassifyRouteFn;
  routeModelFactory?: () => OpsChatModel;
  timeoutMs?: number;
  learningReflector?: LearningReflectorFn;
  summarizer?: ConversationSummarizer;
  budgets?: Partial<SectionBudgets>;
  requests?: RequestStore;
  logger?: Logger;
  approvals?: ApprovalStore;
  /** Override CORS allowlist; default allows all origins (see resolveCorsOrigins). */
  corsOrigins?: string[] | "*";
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

function resolveOverrideRoute(
  strategy: string | undefined,
  reflect: boolean,
): ProductionRoute | undefined {
  if (strategy !== undefined) {
    const parsed = parseOverrideStrategy(strategy);
    if (!parsed) {
      throw new UnknownStrategyError(strategy);
    }
    return parsed;
  }
  if (reflect) {
    return "reflect";
  }
  return undefined;
}

function errorCode(error: unknown): string {
  if (error instanceof UnknownStrategyError) return "unknown_strategy";
  if (error instanceof ConversationNotFoundError) return "conversation_not_found";
  if (error instanceof ChatTimeoutError) return "timeout";
  if (error instanceof ModelUnavailableError) return "model_unavailable";
  if (error instanceof RequestNotFoundError) return "request_not_found";
  if (error instanceof ApprovalNotFoundError) return "approval_not_found";
  if (error instanceof ZodError) return "validation_error";
  if (error instanceof InvalidMemoryInputError) return "validation_error";
  if (error instanceof EmbeddingError) return "internal_error";
  return "internal_error";
}

export function createApp(deps: ChatAppDeps): Express {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const app = express();

  app.use(
    createCorsMiddleware(deps.corsOrigins ?? resolveCorsOrigins()),
  );

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

  async function executeTurn(input: {
    message: string;
    userId: string;
    conversationId?: string;
    strategy?: string;
    reflect: boolean;
    requestId: string;
    requestCreatedAt: number;
  }) {
    const overrideRoute = resolveOverrideRoute(input.strategy, input.reflect);
    return runWithTimeout(
      runProductionTurn(
        {
          conversations: deps.conversations,
          memories: deps.memories,
          strategies: deps.strategies,
          classifyRoute: deps.classifyRoute,
          routeModelFactory: deps.routeModelFactory,
          learningReflector: deps.learningReflector,
          summarizer: deps.summarizer,
          budgets: deps.budgets,
          requests: deps.requests,
          logger: deps.logger,
        },
        {
          message: input.message,
          userId: input.userId,
          conversationId: input.conversationId,
          overrideRoute,
          requestId: input.requestId,
          requestCreatedAt: input.requestCreatedAt,
        },
      ),
      timeoutMs,
    );
  }

  app.post("/chat", async (req, res, next) => {
    const requestId = randomUUID();
    const requestCreatedAt = Date.now();
    res.setHeader("X-Request-Id", requestId);
    deps.logger?.info("chat_request_start", { requestId });

    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        // Unknown strategy string fails refine → treat as 422 when path is strategy
        const strategyIssue = parsed.error.issues.find(
          (issue) => issue.path[0] === "strategy",
        );
        if (strategyIssue && typeof req.body?.strategy === "string") {
          deps.logger?.warn("chat_request_error", {
            requestId,
            httpStatus: 422,
            errorCode: "unknown_strategy",
          });
          res.status(422).json({
            error: "unknown_strategy",
            strategy: req.body.strategy,
          });
          return;
        }
        deps.logger?.warn("chat_request_error", {
          requestId,
          httpStatus: 400,
          errorCode: "validation_error",
        });
        res.status(400).json({
          error: "validation_error",
          issues: parsed.error.issues,
        });
        return;
      }

      const {
        message,
        strategy,
        reflect,
        conversationId,
        userId,
        awaitHumanApproval,
      } = parsed.data;

      if (awaitHumanApproval) {
        if (!deps.approvals) {
          res.status(503).json({ error: "approvals_unavailable" });
          return;
        }

        const pending = deps.approvals.save({
          requestId,
          createdAt: Date.now(),
          summary: truncateSummary(message),
          conversationId: conversationId ?? null,
          chatRequest: {
            message,
            userId,
            strategy,
            reflect,
            conversationId,
          },
        });

        deps.logger?.info("chat_request_end", {
          requestId,
          httpStatus: 202,
          approvalId: pending.approvalId,
        });

        res.status(202).json({
          requestId,
          conversationId: conversationId ?? null,
          pending: {
            approvalId: pending.approvalId,
            summary: pending.summary,
            createdAt: pending.createdAt,
          },
        });
        return;
      }

      const result = await executeTurn({
        message,
        userId,
        conversationId,
        strategy,
        reflect,
        requestId,
        requestCreatedAt,
      });

      res.status(200).json({
        requestId,
        answer: result.answer,
        trace: result.trace,
        metrics: result.metrics,
        conversationId: result.conversationId,
      });
    } catch (error) {
      deps.logger?.error("chat_request_error", {
        requestId,
        errorCode: errorCode(error),
      });
      next(error);
    }
  });

  app.post("/approvals/:approvalId", async (req, res, next) => {
    const requestId = randomUUID();
    const requestCreatedAt = Date.now();
    res.setHeader("X-Request-Id", requestId);

    try {
      const idParsed = approvalIdParamSchema.safeParse(req.params.approvalId);
      if (!idParsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: idParsed.error.issues,
        });
        return;
      }

      const bodyParsed = approvalDecisionSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: bodyParsed.error.issues,
        });
        return;
      }

      if (!deps.approvals) {
        throw new ApprovalNotFoundError(idParsed.data);
      }

      const pending = deps.approvals.take(idParsed.data);
      if (!pending) {
        throw new ApprovalNotFoundError(idParsed.data);
      }

      const { decision, userId } = bodyParsed.data;
      if (userId !== pending.chatRequest.userId) {
        deps.logger?.warn("approval_user_mismatch", {
          requestId,
          approvalId: pending.approvalId,
          priorRequestId: pending.requestId,
        });
      }

      if (decision === "deny") {
        const answer = "Ação cancelada pelo plantonista.";
        const latencyMs = Date.now() - requestCreatedAt;
        res.status(200).json({
          requestId,
          answer,
          trace: [
            {
              type: "answer",
              content: answer,
              node: "approval",
            },
          ],
          metrics: { llmCalls: 0, latencyMs },
          conversationId: pending.conversationId,
        });
        return;
      }

      deps.logger?.info("approval_approve", {
        requestId,
        approvalId: pending.approvalId,
        priorRequestId: pending.requestId,
      });

      const snap = pending.chatRequest;
      const result = await executeTurn({
        message: snap.message,
        userId: snap.userId,
        conversationId: snap.conversationId,
        strategy: snap.strategy,
        reflect: snap.reflect,
        requestId,
        requestCreatedAt,
      });

      res.status(200).json({
        requestId,
        answer: result.answer,
        trace: result.trace,
        metrics: result.metrics,
        conversationId: result.conversationId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/requests/:id", (req, res, next) => {
    try {
      const parsed = requestIdParamSchema.safeParse(req.params.id);
      if (!parsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: parsed.error.issues,
        });
        return;
      }

      if (!deps.requests) {
        throw new RequestNotFoundError(parsed.data);
      }

      const found = deps.requests.getById(parsed.data);
      if (!found) {
        throw new RequestNotFoundError(parsed.data);
      }

      res.status(200).json({
        request: found.request,
        trace: found.trace,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/stats", (req, res, next) => {
    try {
      const parsed = statsQuerySchema.safeParse({
        since: req.query.since ?? "24h",
      });
      if (!parsed.success) {
        res.status(400).json({
          error: "validation_error",
          issues: parsed.error.issues,
        });
        return;
      }

      const sinceRaw = parsed.data.since;
      const windowMs = parseSinceDuration(sinceRaw);
      if (windowMs === null) {
        res.status(400).json({
          error: "validation_error",
          message: "invalid since duration",
        });
        return;
      }

      if (!deps.requests) {
        res.status(200).json({
          since: sinceRaw,
          total: 0,
          errors: 0,
          tokens: 0,
          costUsd: 0,
          latency: { p50: null, p95: null },
          byRoute: {},
          byModel: {},
        });
        return;
      }

      const sinceMs = Date.now() - windowMs;
      const summary = deps.requests.stats(sinceMs);
      res.status(200).json({
        since: sinceRaw,
        ...summary,
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

    if (error instanceof RequestNotFoundError) {
      res.status(404).json({
        error: "request_not_found",
        requestId: error.requestId,
      });
      return;
    }

    if (error instanceof ApprovalNotFoundError) {
      res.status(404).json({
        error: "approval_not_found",
        approvalId: error.approvalId,
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

    if (error instanceof ModelUnavailableError) {
      res.status(503).json({
        error: "model_unavailable",
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
