import { AIMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import type { ReasoningStrategy, StrategyResult, TraceEvent } from "../domain/types.js";

interface PlanExecuteOptions {
  modelFactory: () => ChatOpenAI;
  tools: DynamicStructuredTool[];
  maxIterations: number;
  /** When false, skip the LLM replanner and execute the plan linearly. Default: true. */
  enableReplanner?: boolean;
}

const MAX_STEPS = 8;

const planSchema = z.object({
  steps: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_STEPS)
    .describe("passos curtos, ordenados, executaveis com as ferramentas disponiveis"),
});

/** Flat schema — OpenRouter/models often break on zod discriminatedUnion. */
const replanSchema = z.object({
  decision: z.enum(["adjust", "continue", "finish"]),
  steps: z
    .array(z.string().min(1))
    .max(MAX_STEPS)
    .optional()
    .describe("obrigatório quando decision=adjust"),
  answer: z.string().min(1).optional().describe("obrigatório quando decision=finish"),
});

const PlanExecuteState = Annotation.Root({
  input: Annotation<string>(),
  plan: Annotation<string[]>({
    reducer: (_state, update) => update,
    default: () => [],
  }),
  done: Annotation<[string, string][]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  answer: Annotation<string>({
    reducer: (_state, update) => update,
    default: () => "",
  }),
  trace: Annotation<TraceEvent[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  iterations: Annotation<number>({
    reducer: (_state, update) => update,
    default: () => 0,
  }),
  llmCalls: Annotation<number>({
    reducer: (_state, update) => update,
    default: () => 0,
  }),
});

function formatPlan(steps: string[]): string {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function doneAsText(done: [string, string][]): string {
  if (done.length === 0) {
    return "none";
  }
  return done.map(([step, result], index) => `${index + 1}. ${step}\n   -> ${result}`).join("\n");
}

function buildExecutorUserMessage(
  originalInput: string,
  done: [string, string][],
  currentStep: string,
): string {
  const sections = [
    `Pedido original (contexto — cumpra as restrições literais):\n${originalInput}`,
    "Regras: preserve nomes de serviço exatamente como no pedido; sev1=critical, sev2=high, sev3=medium, sev4=low.",
  ];
  if (done.length > 0) {
    sections.push(`Progresso anterior (use IDs/dados já obtidos):\n${doneAsText(done)}`);
  }
  sections.push(`Passo atual a executar agora:\n${currentStep}`);
  return sections.join("\n\n");
}

function extractAnswer(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message instanceof AIMessage && typeof message.content === "string" && message.content.trim().length > 0) {
      return message.content.trim();
    }
  }
  return "Step executed without textual summary.";
}

function extractActionObservationTrace(messages: unknown[]): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const message of messages) {
    if (message instanceof AIMessage && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        events.push({
          type: "action",
          content: `${call.name}(${JSON.stringify(call.args ?? {})})`,
          tool: call.name,
          toolArgs: (call.args as Record<string, unknown>) ?? {},
        });
      }
      continue;
    }

    if (
      typeof message === "object" &&
      message !== null &&
      "content" in message &&
      "constructor" in message &&
      (message.constructor as { name?: string }).name === "ToolMessage"
    ) {
      const content = String((message as { content: unknown }).content ?? "").trim();
      if (content.length > 0) {
        events.push({ type: "observation", content });
      }
    }
  }

  return events;
}

export class PlanExecuteStrategy implements ReasoningStrategy {
  readonly name = "plan-and-execute";
  private readonly modelFactory: () => ChatOpenAI;
  private readonly tools: DynamicStructuredTool[];
  private readonly maxIterations: number;
  private readonly enableReplanner: boolean;

  constructor(options: PlanExecuteOptions) {
    this.modelFactory = options.modelFactory;
    this.tools = options.tools;
    this.maxIterations = options.maxIterations;
    this.enableReplanner = options.enableReplanner ?? true;
  }

  async run(input: string): Promise<StrategyResult> {
    const startedAt = Date.now();
    const stepLimit = Math.min(MAX_STEPS, this.maxIterations);
    // Fresh model instances: createReactAgent binds tools onto the LLM and must
    // not share the same instance used for withStructuredOutput planner/replanner.
    const plannerModel = this.modelFactory().withStructuredOutput(planSchema);
    const replannerModel = this.modelFactory().withStructuredOutput(replanSchema);

    const planner = async (state: typeof PlanExecuteState.State) => {
      let steps: string[];
      try {
        const plan = await plannerModel.invoke([
          [
            "system",
            [
              "Você é o planner operacional do OpsPilot.",
              `Produza no máximo ${stepLimit} passos curtos, ordenados e executáveis com as tools disponíveis.`,
              "Não invente ferramentas fora de list_alerts, open_incident, resolve_incident.",
              "Preserve literais do pedido (nomes de serviço, IDs, ordem).",
              "Se o pedido falar sev2/sev1/etc, nos passos deixe explícito severity=high/critical/... (sev1=critical, sev2=high, sev3=medium, sev4=low).",
              "Passos que dependem de dados anteriores devem dizer para reutilizar IDs/resultados do progresso.",
            ].join(" "),
          ],
          ["user", state.input],
        ]);
        const parsed = planSchema.parse(plan);
        steps = parsed.steps.slice(0, stepLimit);
      } catch {
        steps = [`Execute o pedido com as tools disponíveis: ${state.input}`];
      }

      return {
        plan: steps,
        trace: [{ type: "plan" as const, content: formatPlan(steps) }],
        llmCalls: state.llmCalls + 1,
      };
    };

    const executor = async (state: typeof PlanExecuteState.State) => {
      if (state.plan.length === 0 || state.iterations >= stepLimit) {
        return {};
      }

      const [currentStep, ...remainingPlan] = state.plan;
      const agent = createReactAgent({ llm: this.modelFactory(), tools: this.tools });
      const result = await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: buildExecutorUserMessage(state.input, state.done, currentStep),
            },
          ],
        },
        { recursionLimit: Math.max(3, stepLimit * 3) },
      );

      const stepResult = extractAnswer(result.messages);
      const stepTrace = extractActionObservationTrace(result.messages);
      const aiMessages = result.messages.filter((message) => message instanceof AIMessage).length;

      return {
        plan: remainingPlan,
        done: [[currentStep, stepResult]] as [string, string][],
        trace: stepTrace,
        iterations: state.iterations + 1,
        llmCalls: state.llmCalls + aiMessages,
      };
    };

    const finishFromDone = (state: typeof PlanExecuteState.State, prefix?: string): string => {
      if (state.done.length > 0) {
        const body = doneAsText(state.done);
        return prefix ? `${prefix}\n${body}` : `Execução concluída com ${state.done.length} passo(s):\n${body}`;
      }
      return prefix ?? "Nenhum passo executado.";
    };

    const replanner = async (state: typeof PlanExecuteState.State) => {
      if (state.iterations >= stepLimit) {
        const answer = finishFromDone(
          state,
          `Limite de ${stepLimit} passos atingido. Progresso:`,
        );
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
        };
      }

      let decision: z.infer<typeof replanSchema>;
      try {
        const raw = await replannerModel.invoke([
          [
            "system",
            [
              "Você é o replanner operacional do OpsPilot.",
              "Decida estritamente entre: adjust, continue, finish.",
              "Escolha finish quando o pedido original já puder ser respondido com o progresso (preencha answer).",
              "A answer de finish deve responder ao pedido original de forma completa (números, serviços, status) — não apenas listar passos.",
              "Escolha adjust quando o plano restante precisar de correção (preencha steps com literais preservados).",
              "Escolha continue quando o plano atual ainda estiver válido.",
            ].join(" "),
          ],
          [
            "user",
            [
              `Pedido original: ${state.input}`,
              `Passos concluídos (${state.done.length}):\n${doneAsText(state.done)}`,
              `Plano restante (${state.plan.length}):\n${formatPlan(state.plan) || "nenhum"}`,
            ].join("\n\n"),
          ],
        ]);
        decision = replanSchema.parse(raw);
      } catch {
        const answer = finishFromDone(state);
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
          llmCalls: state.llmCalls + 1,
        };
      }

      if (decision.decision === "finish") {
        const answer = decision.answer?.trim() || finishFromDone(state);
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
          llmCalls: state.llmCalls + 1,
        };
      }

      if (decision.decision === "adjust") {
        const remainingBudget = stepLimit - state.iterations;
        const revisedPlan = (decision.steps ?? []).filter((step) => step.trim().length > 0).slice(0, remainingBudget);
        if (revisedPlan.length === 0) {
          const answer = finishFromDone(state);
          return {
            answer,
            trace: [{ type: "answer" as const, content: answer }],
            llmCalls: state.llmCalls + 1,
          };
        }

        return {
          plan: revisedPlan,
          trace: [{ type: "critique" as const, content: formatPlan(revisedPlan) }],
          llmCalls: state.llmCalls + 1,
        };
      }

      if (state.plan.length === 0) {
        const answer = finishFromDone(state);
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
          llmCalls: state.llmCalls + 1,
        };
      }

      return {
        trace: [{ type: "critique" as const, content: "Plano atual segue válido; continuar execução." }],
        llmCalls: state.llmCalls + 1,
      };
    };

    const finishWithoutReplanner = async (state: typeof PlanExecuteState.State) => {
      const answer = finishFromDone(state);
      return {
        answer,
        trace: [{ type: "answer" as const, content: answer }],
      };
    };

    const graph = this.enableReplanner
      ? new StateGraph(PlanExecuteState)
          .addNode("planner", planner)
          .addNode("executor", executor)
          .addNode("replanner", replanner)
          .addEdge(START, "planner")
          .addEdge("planner", "executor")
          .addEdge("executor", "replanner")
          .addConditionalEdges("replanner", (state) => {
            if (state.answer) {
              return END;
            }
            if (state.iterations >= stepLimit) {
              return END;
            }
            return "executor";
          })
          .compile()
      : new StateGraph(PlanExecuteState)
          .addNode("planner", planner)
          .addNode("executor", executor)
          .addNode("finish", finishWithoutReplanner)
          .addEdge(START, "planner")
          .addEdge("planner", "executor")
          .addConditionalEdges("executor", (state) => {
            if (state.plan.length === 0 || state.iterations >= stepLimit) {
              return "finish";
            }
            return "executor";
          })
          .addEdge("finish", END)
          .compile();

    const result = await graph.invoke(
      {
        input,
        plan: [],
        done: [],
        answer: "",
        trace: [],
        iterations: 0,
        llmCalls: 0,
      },
      { recursionLimit: Math.max(10, stepLimit * 5) },
    );

    const trace = result.trace.length > 0 ? result.trace : [{ type: "answer" as const, content: "No answer generated." }];
    const answer = result.answer || trace.filter((event) => event.type === "answer").at(-1)?.content || "No answer generated.";

    return {
      answer,
      trace,
      metrics: {
        llmCalls: result.llmCalls,
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}
