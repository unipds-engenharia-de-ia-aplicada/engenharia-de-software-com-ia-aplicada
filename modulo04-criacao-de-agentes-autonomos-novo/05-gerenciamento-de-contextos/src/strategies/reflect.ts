import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { addPromptTokens } from "../context/tokens.js";
import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunInput,
  TraceEvent,
} from "../domain/types.js";

export const critiqueSchema = z.object({
  approved: z.boolean(),
  feedback: z
    .string()
    .describe("se não aprovado: o que corrigir, em específico e acionável"),
});

export type CritiqueResult = z.infer<typeof critiqueSchema>;

/**
 * Critic callable. `originalInput` is the user request (Pedido) so the LLM
 * critic can judge the answer against the request + trace observations.
 */
export type CriticFn = (
  answer: string,
  trace: TraceEvent[],
  originalInput: string,
) => Promise<CritiqueResult>;

export interface ReflectionOpts {
  maxReflections?: number;
  critic?: CriticFn;
  modelFactory?: () => ChatOpenAI;
}

const CRITIC_PROMPT = [
  "Você é um crítico rigoroso de respostas de um agente de operações.",
  "Avalie APENAS contra as observações do trace e o pedido original.",
  "Não invente fatos que não apareçam nas observações.",
  "Se a resposta estiver completa e fiel às observações, approved=true.",
  "Se faltar informação exigida pelo pedido ou houver inconsistência com as observações, approved=false e descreva o que corrigir de forma específica e acionável.",
].join(" ");

function observationsOf(trace: TraceEvent[]): string {
  const observations = trace
    .filter((event) => event.type === "observation")
    .map((event) => event.content);
  return observations.length > 0 ? observations.join("\n") : "(nenhuma)";
}

export function enrichInputWithFeedback(
  originalInput: string,
  round: number,
  feedback: string,
): string {
  const feedbackBody = feedback.trim() === "" ? "(sem feedback adicional)" : feedback;
  return `[Critique - Round ${round}]:\n${feedbackBody}\n\nOriginal request:\n${originalInput}`;
}

export function createLLMCritic(modelFactory: () => ChatOpenAI): CriticFn {
  return async (answer, trace, originalInput) => {
    try {
      const raw = await modelFactory()
        .withStructuredOutput(critiqueSchema)
        .invoke([
          ["system", CRITIC_PROMPT],
          [
            "user",
            `Pedido: ${originalInput}\nObservações: ${observationsOf(trace)}\nResposta: ${answer}`,
          ],
        ]);
      return critiqueSchema.parse(raw);
    } catch {
      // FR-012: fail-safe — treat invalid critic output as approval
      return { approved: true, feedback: "" };
    }
  };
}

function resolveCritic(opts: ReflectionOpts, maxReflections: number): CriticFn | undefined {
  if (opts.critic) {
    return opts.critic;
  }
  if (maxReflections > 0 && opts.modelFactory) {
    return createLLMCritic(opts.modelFactory);
  }
  return undefined;
}

function critiqueEventContent(feedback: string): string {
  return feedback.trim() === "" ? "[Crítico aprovou sem feedback]" : feedback;
}

function metricsWithOptionalPromptTokens(
  llmCalls: number,
  latencyMs: number,
  promptTokens: number | undefined,
): StrategyResult["metrics"] {
  return {
    llmCalls,
    latencyMs,
    ...(promptTokens !== undefined ? { promptTokens } : {}),
  };
}

export function withReflection(
  strategy: ReasoningStrategy,
  opts: ReflectionOpts = {},
): ReasoningStrategy {
  const maxReflections = opts.maxReflections ?? 2;
  const criticFn = resolveCritic(opts, maxReflections);
  const effectiveMax = criticFn === undefined ? 0 : maxReflections;

  return {
    name: `reflect:${strategy.name}`,
    async run(input: StrategyRunInput): Promise<StrategyResult> {
      const startedAt = Date.now();
      let totalLlmCalls = 0;
      let criticCallCount = 0;
      let totalPromptTokens: number | undefined;
      const accumulatedTrace: TraceEvent[] = [];

      let currentResult = await strategy.run(input);
      totalLlmCalls += currentResult.metrics.llmCalls;
      totalPromptTokens = addPromptTokens(
        totalPromptTokens,
        currentResult.metrics.promptTokens,
      );
      accumulatedTrace.push(...currentResult.trace);

      if (effectiveMax === 0 || !criticFn) {
        return {
          answer: currentResult.answer,
          trace: accumulatedTrace,
          metrics: metricsWithOptionalPromptTokens(
            totalLlmCalls,
            Date.now() - startedAt,
            totalPromptTokens,
          ),
        };
      }

      for (let round = 1; round <= effectiveMax; round += 1) {
        const critiqueResult = await criticFn(
          currentResult.answer,
          currentResult.trace,
          input.message,
        );
        criticCallCount += 1;
        // Critic via withStructuredOutput typically has no AIMessage usage — best-effort omit.

        accumulatedTrace.push({
          type: "critique",
          content: critiqueEventContent(critiqueResult.feedback),
          round,
          approved: critiqueResult.approved,
          timestampMs: Date.now(),
        });

        if (critiqueResult.approved) {
          break;
        }

        const enrichedInput: StrategyRunInput = {
          message: enrichInputWithFeedback(input.message, round, critiqueResult.feedback),
          history: input.history,
        };
        currentResult = await strategy.run(enrichedInput);
        totalLlmCalls += currentResult.metrics.llmCalls;
        totalPromptTokens = addPromptTokens(
          totalPromptTokens,
          currentResult.metrics.promptTokens,
        );
        accumulatedTrace.push(...currentResult.trace);
      }

      return {
        answer: currentResult.answer,
        trace: accumulatedTrace,
        metrics: metricsWithOptionalPromptTokens(
          totalLlmCalls + criticCallCount,
          Date.now() - startedAt,
          totalPromptTokens,
        ),
      };
    },
  };
}
