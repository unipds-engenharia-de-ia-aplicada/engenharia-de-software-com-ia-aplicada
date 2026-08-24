import { AIMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import type { OpsChatModel } from "../agents/model.js";
import type { TraceEvent } from "../domain/types.js";
import { buildTraceFromMessages } from "../trace/builder.js";
import {
  renderBlackboard,
  type BlackboardEntry,
  type BlackboardKind,
} from "./blackboard.js";
import type { TeamRole } from "./supervisor.js";

export const ANALISTA_SYSTEM_PROMPT = [
  "Você é o ANALISTA do plantão. Sua única função: produzir diagnóstico FACTUAL do estado atual, usando as ferramentas de leitura.",
  "Liste: alertas disparando (com severidade), incidentes recentes (abertos e resolvidos), runbooks relevantes, status dos provedores e fatos conhecidos do time.",
  "NÃO proponha soluções. NÃO abra nem resolva nada.",
  "Formato: tópicos telegráficos. Seja cético: se um dado não está nas observações, não afirme.",
].join("\n");

export const PLANEJADOR_SYSTEM_PROMPT = [
  "Você é o PLANEJADOR do plantão. Sua única função: transformar os fatos do blackboard em um plano de ação.",
  "Produza um plano numerado, em passos curtos e executáveis, baseado APENAS no que está no blackboard.",
  "Você não tem ferramentas: NÃO execute nada, NÃO invente dados que não estejam no blackboard.",
  "Se os fatos forem insuficientes, diga exatamente qual informação falta.",
].join("\n");

export const EXECUTOR_SYSTEM_PROMPT = [
  "Você é o EXECUTOR do plantão. Sua única função: executar ações de incidente (abrir, resolver, listar) conforme o brief e o plano do blackboard.",
  "Use somente as ferramentas disponíveis; não invente IDs de incidente — quando necessário, liste antes de agir.",
  "Reporte cada ação executada e o resultado observado.",
  "Não faça diagnóstico novo nem replaneje: siga o plano.",
].join("\n");

export interface RoleRunInput {
  message: string;
  brief: string;
  blackboard: BlackboardEntry[];
}

export interface RoleRunResult {
  entry: BlackboardEntry;
  trace: TraceEvent[];
  llmCalls: number;
}

export interface RoleRunner {
  readonly role: TeamRole;
  /** Structural capability contract — inspected by tests (FR-007). */
  readonly tools: DynamicStructuredTool[];
  run(input: RoleRunInput): Promise<RoleRunResult>;
}

const DEFAULT_MAX_ITERATIONS = 6;

function roleUserMessage(input: RoleRunInput): string {
  return [
    `Pedido original do plantonista: ${input.message}`,
    `Sua tarefa (brief do supervisor): ${input.brief}`,
    "",
    "Blackboard atual:",
    renderBlackboard(input.blackboard),
  ].join("\n");
}

interface ToolRoleOptions {
  role: TeamRole;
  kind: BlackboardKind;
  prompt: string;
  modelFactory: () => OpsChatModel;
  tools: DynamicStructuredTool[];
  maxIterations?: number;
}

function createToolRoleRunner(options: ToolRoleOptions): RoleRunner {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  return {
    role: options.role,
    tools: options.tools,
    async run(input) {
      const agent = createReactAgent({
        llm: options.modelFactory() as never,
        tools: options.tools,
        prompt: options.prompt,
      });
      const result = await agent.invoke(
        { messages: [{ role: "user" as const, content: roleUserMessage(input) }] },
        { recursionLimit: Math.max(3, maxIterations * 3) },
      );
      const trace = buildTraceFromMessages(result.messages, options.role);
      const content =
        trace.filter((event) => event.type === "answer").at(-1)?.content ?? "";
      const llmCalls = result.messages.filter(
        (message) => message instanceof AIMessage,
      ).length;
      return {
        entry: {
          role: options.role,
          kind: options.kind,
          brief: input.brief,
          content,
        },
        trace,
        llmCalls,
      };
    },
  };
}

export function createAnalistaRunner(options: {
  modelFactory: () => OpsChatModel;
  tools: DynamicStructuredTool[];
  maxIterations?: number;
}): RoleRunner {
  return createToolRoleRunner({
    role: "analista",
    kind: "facts",
    prompt: ANALISTA_SYSTEM_PROMPT,
    ...options,
  });
}

export function createExecutorRunner(options: {
  modelFactory: () => OpsChatModel;
  tools: DynamicStructuredTool[];
  maxIterations?: number;
}): RoleRunner {
  return createToolRoleRunner({
    role: "executor",
    kind: "execution",
    prompt: EXECUTOR_SYSTEM_PROMPT,
    ...options,
  });
}

/** Planejador has zero tools by signature: pure model call over the blackboard. */
export function createPlanejadorRunner(options: {
  modelFactory: () => OpsChatModel;
}): RoleRunner {
  return {
    role: "planejador",
    tools: [],
    async run(input) {
      const response = await options.modelFactory().invoke([
        ["system", PLANEJADOR_SYSTEM_PROMPT],
        ["user", roleUserMessage(input)],
      ]);
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
      return {
        entry: {
          role: "planejador",
          kind: "plan",
          brief: input.brief,
          content,
        },
        trace: [{ type: "plan", content, node: "planejador" }],
        llmCalls: 1,
      };
    },
  };
}
