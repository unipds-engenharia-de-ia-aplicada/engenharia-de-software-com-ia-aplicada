import type { DynamicStructuredTool } from "@langchain/core/tools";

import type { OpsChatModel } from "../agents/model.js";
import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunInput,
} from "../domain/types.js";
import {
  createAnalistaRunner,
  createExecutorRunner,
  createPlanejadorRunner,
  type RoleRunner,
} from "./roles.js";
import {
  createDecideNext,
  type DecideNextFn,
  type TeamRole,
} from "./supervisor.js";
import { runTeamGraph, type TeamGraphDeps } from "./team-graph.js";

export interface TeamStrategyOptions {
  modelFactory: () => OpsChatModel;
  /** Read-only tools (structural restriction — FR-007). */
  analistaTools: DynamicStructuredTool[];
  /** Incident tools only (structural restriction — FR-007). */
  executorTools: DynamicStructuredTool[];
  /** Deterministic supervisor for tests (skips LLM; not counted in llmCalls). */
  decideNext?: DecideNextFn;
  /** Per-role overrides for tests. */
  roleRunners?: Partial<Record<TeamRole, RoleRunner>>;
}

function composeMessage(input: StrategyRunInput): string {
  if (input.history.length === 0) {
    return input.message;
  }
  const history = input.history
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  return ["Histórico recente da conversa:", history, "", input.message].join("\n");
}

export class TeamStrategy implements ReasoningStrategy {
  readonly name = "team";
  private readonly deps: TeamGraphDeps;

  constructor(options: TeamStrategyOptions) {
    this.deps = {
      decideNext: options.decideNext ?? createDecideNext(options.modelFactory),
      supervisorLlmCalls: options.decideNext ? 0 : 1,
      roleRunners: {
        analista:
          options.roleRunners?.analista ??
          createAnalistaRunner({
            modelFactory: options.modelFactory,
            tools: options.analistaTools,
          }),
        planejador:
          options.roleRunners?.planejador ??
          createPlanejadorRunner({ modelFactory: options.modelFactory }),
        executor:
          options.roleRunners?.executor ??
          createExecutorRunner({
            modelFactory: options.modelFactory,
            tools: options.executorTools,
          }),
      },
    };
  }

  async run(input: StrategyRunInput): Promise<StrategyResult> {
    const startedAt = Date.now();
    const result = await runTeamGraph(this.deps, {
      message: composeMessage(input),
    });
    return {
      answer: result.answer,
      trace: result.trace,
      metrics: {
        llmCalls: result.llmCalls,
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}
