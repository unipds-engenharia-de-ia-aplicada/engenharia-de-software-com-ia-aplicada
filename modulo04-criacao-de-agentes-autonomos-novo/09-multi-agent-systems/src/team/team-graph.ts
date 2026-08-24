import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { TraceEvent } from "../domain/types.js";
import { renderBlackboard, type BlackboardEntry } from "./blackboard.js";
import type { RoleRunner } from "./roles.js";
import {
  supervisorDecisionSchema,
  type DecideNextFn,
  type SupervisorDecision,
  type TeamRole,
} from "./supervisor.js";

/** Domain cap of supervisor delegations per turn (spec 018, US5). */
export const MAX_HANDOFFS = 8;

/** Stable prefixes asserted by tests and documented in contracts/trace-handoff.md. */
export const CAP_REACHED_PREFIX = "teto de handoffs atingido";
export const INVALID_DECISION_PREFIX = "decisão inválida do supervisor";

export interface TeamGraphDeps {
  decideNext: DecideNextFn;
  roleRunners: Record<TeamRole, RoleRunner>;
  /** LLM calls consumed per real supervisor decision (0 for injected fakes). */
  supervisorLlmCalls?: number;
}

const TeamState = Annotation.Root({
  message: Annotation<string>(),
  blackboard: Annotation<BlackboardEntry[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  handoffCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  brief: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  next: Annotation<TeamRole | "done" | null>({
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
  llmCalls: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),
});

type TeamStateType = typeof TeamState.State;

function handoffEvent(to: string, content: string): TraceEvent {
  return { type: "handoff", node: "supervisor", to, content };
}

export function createTeamGraph(deps: TeamGraphDeps) {
  const supervisorLlmCalls = deps.supervisorLlmCalls ?? 0;

  const supervisorNode = async (state: TeamStateType) => {
    if (state.handoffCount >= MAX_HANDOFFS) {
      const content = `${CAP_REACHED_PREFIX}: encerrando com o conteúdo do blackboard`;
      return {
        next: "done" as const,
        brief: "",
        trace: [handoffEvent("done", content)],
      };
    }

    let decision: SupervisorDecision;
    try {
      decision = supervisorDecisionSchema.parse(
        await deps.decideNext({
          message: state.message,
          blackboard: state.blackboard,
          handoffCount: state.handoffCount,
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const content = `${INVALID_DECISION_PREFIX}: ${detail}`;
      return {
        next: "done" as const,
        brief: "",
        llmCalls: supervisorLlmCalls,
        trace: [handoffEvent("done", content)],
      };
    }

    const isDelegation = decision.next !== "done";
    return {
      next: decision.next,
      brief: decision.brief,
      handoffCount: state.handoffCount + (isDelegation ? 1 : 0),
      llmCalls: supervisorLlmCalls,
      trace: [handoffEvent(decision.next, decision.brief)],
    };
  };

  const roleNode = (role: TeamRole) => async (state: TeamStateType) => {
    const runner = deps.roleRunners[role];
    try {
      const result = await runner.run({
        message: state.message,
        brief: state.brief,
        blackboard: state.blackboard,
      });
      return {
        blackboard: [result.entry],
        trace: result.trace,
        llmCalls: result.llmCalls,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const content = `erro no papel ${role}: ${detail}`;
      return {
        blackboard: [
          { role, kind: "error" as const, brief: state.brief, content },
        ],
        trace: [{ type: "observation" as const, content, node: role }],
      };
    }
  };

  /**
   * done: brief carries the supervisor's final summary (user contract);
   * forced/anomalous closures arrive with empty brief and fall back to blackboard.
   */
  const doneNode = async (state: TeamStateType) => {
    const brief = state.brief.trim();
    let answer: string;
    if (brief.length > 0) {
      answer = brief;
    } else if (state.blackboard.length > 0) {
      answer = `Resumo do blackboard:\n${renderBlackboard(state.blackboard)}`;
    } else {
      answer = `A equipe encerrou sem contribuições no blackboard para: ${state.message}`;
    }
    return {
      answer,
      trace: [{ type: "answer" as const, content: answer, node: "supervisor" }],
    };
  };

  return new StateGraph(TeamState)
    .addNode("supervisor", supervisorNode)
    .addNode("analista", roleNode("analista"))
    .addNode("planejador", roleNode("planejador"))
    .addNode("executor", roleNode("executor"))
    .addNode("done", doneNode)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", (state) => state.next ?? "done", {
      analista: "analista",
      planejador: "planejador",
      executor: "executor",
      done: "done",
    })
    .addEdge("analista", "supervisor")
    .addEdge("planejador", "supervisor")
    .addEdge("executor", "supervisor")
    .addEdge("done", END)
    .compile();
}

export type CompiledTeamGraph = ReturnType<typeof createTeamGraph>;

export interface TeamTurnResult {
  answer: string;
  trace: TraceEvent[];
  llmCalls: number;
}

export async function runTeamGraph(
  deps: TeamGraphDeps,
  input: { message: string },
): Promise<TeamTurnResult> {
  const graph = createTeamGraph(deps);
  const finalState = await graph.invoke(
    {
      message: input.message,
      blackboard: [],
      handoffCount: 0,
      brief: "",
      next: null,
      answer: "",
      trace: [],
      llmCalls: 0,
    },
    // Sized above the cap so GraphRecursionError never fires before MAX_HANDOFFS.
    { recursionLimit: MAX_HANDOFFS * 3 + 10 },
  );
  return {
    answer: finalState.answer,
    trace: finalState.trace,
    llmCalls: finalState.llmCalls,
  };
}
