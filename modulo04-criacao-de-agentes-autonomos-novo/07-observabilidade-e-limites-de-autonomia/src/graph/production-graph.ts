import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  OpsResilientChatModel,
  type OpsChatModel,
} from "../agents/model.js";

import { OPSPILOT_SYSTEM_PROMPT } from "../agents/system-prompt.js";
import type { ConversationSummarizer } from "../chat/history-summarizer.js";
import {
  HISTORY_LIMIT,
  maybeSummarize,
} from "../chat/history-summarizer.js";
import {
  buildContext,
  type SectionBudgets,
} from "../context/context-builder.js";
import { buildContextBreakdown } from "../context/tokens.js";
import type {
  ContextBreakdown,
  ConversationStore,
  ExecutionMetrics,
  Logger,
  MemoryStore,
  ReasoningStrategy,
  RequestStore,
  StrategyResult,
  TraceEvent,
} from "../domain/types.js";
import {
  createEmptyTelemetry,
  getModelTelemetry,
  runWithModelTelemetry,
} from "../llm/model-telemetry.js";
import { runWithChatUser } from "../memory/chat-user-context.js";
import {
  prepareMemoriesForTurn,
  type LearningReflectorFn,
} from "../memory/learning-reflector.js";
import {
  createClassifyRoute,
  type ClassifyRouteFn,
  type ProductionRoute,
} from "./router.js";
import { stampNode } from "./stamp-node.js";

export interface ChatTurnResult {
  conversationId: string;
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics & {
    historyMessages: number;
    recalledMemories: number;
    contextBreakdown: ContextBreakdown;
    route: string;
    routeReason: string;
    modelUsed: string;
  };
}

export interface ProductionStrategies {
  react: ReasoningStrategy;
  planExecute: ReasoningStrategy;
  reflect: ReasoningStrategy;
}

export interface ProductionGraphDeps {
  conversations: ConversationStore;
  memories: MemoryStore;
  strategies: ProductionStrategies;
  /** Injected for tests; default uses routeModelFactory + withStructuredOutput. */
  classifyRoute?: ClassifyRouteFn;
  routeModelFactory?: () => OpsChatModel;
  learningReflector?: LearningReflectorFn;
  summarizer?: ConversationSummarizer;
  budgets?: Partial<SectionBudgets>;
  execute?: (promise: Promise<StrategyResult>) => Promise<StrategyResult>;
  /** Optional audit store — persisted in resposta node. */
  requests?: RequestStore;
  /** Optional structured logger — metadata only. */
  logger?: Logger;
}

export interface ProductionTurnInput {
  message: string;
  userId: string;
  conversationId?: string;
  /** When set, roteador skips LLM and marks override. */
  overrideRoute?: ProductionRoute;
  /** Correlation id from HTTP (X-Request-Id). */
  requestId?: string;
  /** Epoch ms when the HTTP handler minted requestId. */
  requestCreatedAt?: number;
}

type BuiltContext = ReturnType<typeof buildContext>;

const GraphState = Annotation.Root({
  message: Annotation<string>(),
  userId: Annotation<string>(),
  conversationId: Annotation<string>(),
  requestId: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  requestCreatedAt: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  overrideRoute: Annotation<ProductionRoute | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  built: Annotation<BuiltContext | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  route: Annotation<ProductionRoute | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  answer: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  trace: Annotation<TraceEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  strategyMetrics: Annotation<ExecutionMetrics | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  routerLlmCalls: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

type GraphStateType = typeof GraphState.State;

function resolveClassifier(deps: ProductionGraphDeps): ClassifyRouteFn {
  if (deps.classifyRoute) {
    return deps.classifyRoute;
  }
  if (deps.routeModelFactory) {
    return createClassifyRoute(deps.routeModelFactory);
  }
  return async () => ({
    route: "react",
    reason: "fallback: no classifier configured; using react",
  });
}

function persistTurnAudit(
  deps: ProductionGraphDeps,
  state: GraphStateType,
  trace: TraceEvent[],
  metrics: ExecutionMetrics,
): void {
  if (!deps.requests || !state.requestId) {
    return;
  }
  try {
    deps.requests.save({
      id: state.requestId,
      createdAt: state.requestCreatedAt || Date.now(),
      finishedAt: Date.now(),
      status: "success",
      httpStatus: 200,
      conversationId: state.conversationId || null,
      userId: state.userId,
      metrics,
      trace,
    });
  } catch (error) {
    deps.logger?.error("request_persist_failed", {
      requestId: state.requestId,
      errorName: error instanceof Error ? error.name : "Error",
      node: "resposta",
    });
  }
}

export function createProductionGraph(deps: ProductionGraphDeps) {
  const classify = resolveClassifier(deps);

  const contextNode = async (state: GraphStateType) => {
    const conversationId =
      state.conversationId && state.conversationId.length > 0
        ? state.conversationId
        : deps.conversations.create();

    const trace: TraceEvent[] = [];
    if (deps.summarizer) {
      const summarized = await maybeSummarize({
        conversations: deps.conversations,
        conversationId,
        summarizer: deps.summarizer,
      });
      if (summarized) {
        trace.push({ ...summarized.event, node: "contexto" });
      }
    }

    const history = deps.conversations.lastMessages(conversationId, HISTORY_LIMIT);
    const summaryRecord = deps.conversations.getSummary(conversationId);
    const recalled = await prepareMemoriesForTurn({
      reflector: deps.learningReflector,
      memories: deps.memories,
      userId: state.userId,
      userMessage: state.message,
    });

    const built = buildContext(
      {
        system: OPSPILOT_SYSTEM_PROMPT,
        summary: summaryRecord?.text ?? null,
        history,
        memories: recalled,
        message: state.message,
      },
      { budgets: deps.budgets },
    );

    deps.conversations.append(conversationId, "user", state.message);

    return {
      conversationId,
      built,
      trace,
    };
  };

  const routerNode = async (state: GraphStateType) => {
    if (state.overrideRoute) {
      const reason = "override from request";
      return {
        route: state.overrideRoute,
        routerLlmCalls: 0,
        trace: [
          {
            type: "route" as const,
            node: "roteador",
            content: reason,
            reason,
            route: state.overrideRoute,
            override: true,
          },
        ],
      };
    }

    let decision: { route: ProductionRoute; reason: string };
    // Injected classifiers are fakes — do not inflate llmCalls.
    const routerLlmCalls = deps.classifyRoute ? 0 : 1;
    try {
      decision = await classify({ message: state.message });
      if (
        decision.route !== "react" &&
        decision.route !== "planExecute" &&
        decision.route !== "reflect"
      ) {
        decision = { route: "react", reason: "fallback: invalid route; using react" };
      }
    } catch {
      decision = { route: "react", reason: "fallback: router failed; using react" };
    }

    return {
      route: decision.route,
      routerLlmCalls,
      trace: [
        {
          type: "route" as const,
          node: "roteador",
          content: decision.reason,
          reason: decision.reason,
          route: decision.route,
          override: false,
        },
      ],
    };
  };

  const runStrategy = async (
    state: GraphStateType,
    strategy: ReasoningStrategy,
    node: ProductionRoute,
  ) => {
    if (!state.built) {
      throw new Error("production graph: missing built context");
    }
    const built = state.built;
    const runPromise = strategy.run({
      message: built.enrichedMessage,
      history: built.history,
    });
    const result =
      (await deps.execute?.(runPromise)) ?? (await runPromise);

    return {
      answer: result.answer,
      strategyMetrics: result.metrics,
      trace: stampNode(node, result.trace),
    };
  };

  const reactNode = (state: GraphStateType) =>
    runStrategy(state, deps.strategies.react, "react");
  const planExecuteNode = (state: GraphStateType) =>
    runStrategy(state, deps.strategies.planExecute, "planExecute");
  const reflectNode = (state: GraphStateType) =>
    runStrategy(state, deps.strategies.reflect, "reflect");

  /**
   * Resposta: grava histórico, persiste audit + log metadata.
   * Learning runs in prepareMemoriesForTurn (await for organize; else deferred).
   */
  const answerNode = async (state: GraphStateType) => {
    deps.conversations.append(state.conversationId, "assistant", state.answer);

    const built = state.built;
    const strategyMetrics = state.strategyMetrics ?? { llmCalls: 0, latencyMs: 0 };
    const tel = getModelTelemetry();
    const modelUsed = tel?.modelUsed ?? tel?.primaryModel ?? "unknown";

    const extraTrace: TraceEvent[] = [];
    if (tel?.fallbackUsed && tel.fallbackModel) {
      const already = state.trace.some((event) => event.type === "fallback");
      if (!already) {
        extraTrace.push({
          type: "fallback",
          node: "resposta",
          content: `${tel.primaryModel} → ${tel.fallbackModel}`,
        });
      }
    }

    const fullTrace = [...state.trace, ...extraTrace];
    const routeEvent = fullTrace.find((event) => event.type === "route");
    const route = state.route ?? routeEvent?.route ?? "react";
    const routeReason =
      routeEvent?.reason ?? routeEvent?.content ?? "route unavailable";

    const metrics: ExecutionMetrics = {
      ...strategyMetrics,
      llmCalls: strategyMetrics.llmCalls + (state.routerLlmCalls ?? 0),
      route,
      routeReason,
      modelUsed,
    };
    if (built) {
      metrics.historyMessages = built.historyMessages;
      metrics.recalledMemories = built.recalledMemories;
      metrics.contextBreakdown = buildContextBreakdown({
        system: built.system,
        history: built.historyText,
        memories: built.memoriesText,
        message: built.message,
        summary: built.summaryText,
      });
    }
    if (strategyMetrics.promptTokens === undefined) {
      delete metrics.promptTokens;
    }

    persistTurnAudit(deps, state, fullTrace, metrics);

    deps.logger?.info("chat_request_end", {
      requestId: state.requestId || undefined,
      node: "resposta",
      type: "done",
      route,
      httpStatus: 200,
      latencyMs: metrics.latencyMs,
      llmCalls: metrics.llmCalls,
      promptTokens: metrics.promptTokens ?? null,
      traceEventCount: fullTrace.length,
      modelUsed,
    });

    return extraTrace.length > 0 ? { trace: extraTrace } : {};
  };

  const graph = new StateGraph(GraphState)
    .addNode("contexto", contextNode)
    .addNode("roteador", routerNode)
    .addNode("react", reactNode)
    .addNode("planExecute", planExecuteNode)
    .addNode("reflect", reflectNode)
    .addNode("resposta", answerNode)
    .addEdge(START, "contexto")
    .addEdge("contexto", "roteador")
    .addConditionalEdges("roteador", (s) => s.route ?? "react", {
      react: "react",
      planExecute: "planExecute",
      reflect: "reflect",
    })
    .addEdge("react", "resposta")
    .addEdge("planExecute", "resposta")
    .addEdge("reflect", "resposta")
    .addEdge("resposta", END)
    .compile();

  return graph;
}

export type CompiledProductionGraph = ReturnType<typeof createProductionGraph>;

export async function runProductionTurn(
  deps: ProductionGraphDeps,
  input: ProductionTurnInput,
): Promise<ChatTurnResult> {
  const graph = createProductionGraph(deps);

  // Prefer telemetry seeded from routeModelFactory when it is an OpsResilientChatModel.
  const seedModel = deps.routeModelFactory?.();
  const telemetry =
    seedModel instanceof OpsResilientChatModel
      ? seedModel.createTelemetry()
      : createEmptyTelemetry(
          process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini",
          process.env.OPENROUTER_MODEL_FALLBACK?.trim() || undefined,
        );

  const finalState = await runWithModelTelemetry(telemetry, () =>
    runWithChatUser(input.userId, async () =>
      graph.invoke({
        message: input.message,
        userId: input.userId,
        conversationId: input.conversationId ?? "",
        requestId: input.requestId ?? "",
        requestCreatedAt: input.requestCreatedAt ?? Date.now(),
        overrideRoute: input.overrideRoute ?? null,
        built: null,
        route: null,
        answer: "",
        trace: [],
        strategyMetrics: null,
        routerLlmCalls: 0,
      }),
    ),
  );

  const built = finalState.built;
  if (!built) {
    throw new Error("production graph: turn finished without context");
  }

  const strategyMetrics = finalState.strategyMetrics ?? {
    llmCalls: 0,
    latencyMs: 0,
  };

  const contextBreakdown = buildContextBreakdown({
    system: built.system,
    history: built.historyText,
    memories: built.memoriesText,
    message: built.message,
    summary: built.summaryText,
  });

  const routeEvent = finalState.trace.find((event) => event.type === "route");
  const route = finalState.route ?? routeEvent?.route ?? "react";
  const routeReason =
    routeEvent?.reason ?? routeEvent?.content ?? "route unavailable";

  const tel = getModelTelemetry() ?? telemetry;
  const modelUsed = tel.modelUsed ?? tel.primaryModel;
  // Fallback event is stamped in resposta when telemetry marks reserve;
  // keep a safety net if resposta did not run extras for any reason.
  let trace = finalState.trace;
  if (tel.fallbackUsed && tel.fallbackModel) {
    const already = trace.some((event) => event.type === "fallback");
    if (!already) {
      trace = [
        ...trace,
        {
          type: "fallback",
          node: "resposta",
          content: `${tel.primaryModel} → ${tel.fallbackModel}`,
        },
      ];
    }
  }

  const metrics: ChatTurnResult["metrics"] = {
    ...strategyMetrics,
    llmCalls: strategyMetrics.llmCalls + (finalState.routerLlmCalls ?? 0),
    historyMessages: built.historyMessages,
    recalledMemories: built.recalledMemories,
    contextBreakdown,
    route,
    routeReason,
    modelUsed,
  };
  if (strategyMetrics.promptTokens === undefined) {
    delete metrics.promptTokens;
  }

  return {
    conversationId: finalState.conversationId,
    answer: finalState.answer,
    trace,
    metrics,
  };
}
