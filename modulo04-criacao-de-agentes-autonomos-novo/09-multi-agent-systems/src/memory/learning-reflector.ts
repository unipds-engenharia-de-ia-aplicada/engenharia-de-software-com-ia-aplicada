import type { OpsChatModel } from "../agents/model.js";
import { z } from "zod";

import type { MemoryStore, RecalledMemory } from "../domain/types.js";

/** Canonical durable fact for plantão organization / listing by severity. */
export const PLANTAO_ORG_MEMORY_FACT =
  "Ao organizar o plantão ou listar incidentes/alertas nos Achados, ordenar por severidade: critical, depois high, medium, low.";

export const LEARNING_REFLECTOR_PROMPT = [
  "Você destila APRENDIZADOS DURÁVEIS da mensagem do usuário para memória de longo prazo de um copiloto de plantão (OpsPilot).",
  "hasLearning=true SOMENTE se a mensagem contiver preferência ou fato operacional DURÁVEL (ex.: \"sempre priorize o serviço checkout\", \"prefiro resumos curtos\").",
  "hasLearning=true também quando o usuário pedir para ORGANIZAR o plantão / listagem (ex.: \"organize meu plantão\", \"organize e mostre os incidentes\", \"liste por prioridade/severidade\"): grave um fato estável de preferência de ordenação — NÃO trate isso como pedido pontual descartável.",
  `Nesse caso, fact pode ser: "${PLANTAO_ORG_MEMORY_FACT}" (ou equivalente em uma frase).`,
  "hasLearning=false para pedidos PONTUAIS one-shot SEM organização/prioridade (ex.: \"liste alertas\", \"abra um incidente\", \"resolva X agora\", perguntas efêmeras de status).",
  "hasLearning=false se a mensagem contiver SEGREDOS ou dados sensíveis (senhas, tokens, API keys, credenciais, secrets).",
  "Quando hasLearning=true, fact deve ser um enunciado estável em uma frase (não copie o pedido pontual bruto).",
  "Quando hasLearning=false, fact deve ser string vazia.",
].join(" ");

export const learningReflectionSchema = z.object({
  hasLearning: z
    .boolean()
    .describe(
      "true somente se a mensagem contiver preferência ou fato operacional DURÁVEL elegível a memória (nunca pedido pontual puro, nunca segredo; organizar plantão/listagem por prioridade CONTA como durável)",
    ),
  fact: z
    .string()
    .describe(
      "Enunciado estável em 1 frase; string vazia se hasLearning=false. Nunca copie pedido pontual nem segredo.",
    ),
});

export type LearningReflection = z.infer<typeof learningReflectionSchema>;

export type LearningReflectorFn = (userMessage: string) => Promise<LearningReflection>;

const NO_LEARNING: LearningReflection = { hasLearning: false, fact: "" };

/** True when the message asks to organize the shift / list by priority. */
export function suggestsPlantaoOrganization(message: string): boolean {
  const text = message.toLowerCase();
  const organizes =
    /\borganiz/.test(text) ||
    /\bpriorid/.test(text) ||
    /\bseveridade\b/.test(text) ||
    /\border/.test(text);
  const listingContext =
    /\bplant[aã]o\b/.test(text) ||
    /\bincident/.test(text) ||
    /\balerta/.test(text) ||
    /\blist/.test(text) ||
    /\bmostr/.test(text);
  return organizes && (listingContext || /\borganiz/.test(text));
}

/**
 * Recall query: when the user asks to organize the plantão, enrich the query so
 * durable organization preferences are retrieved even if the wording differs.
 */
export function buildMemoryRecallQuery(message: string): string {
  if (!suggestsPlantaoOrganization(message)) {
    return message;
  }
  return [
    message.trim(),
    "preferência organização plantão",
    "ordenar Achados por severidade critical high medium low",
  ].join("\n");
}

export function createLLMLearningReflector(
  modelFactory: () => OpsChatModel,
): LearningReflectorFn {
  return async (userMessage: string): Promise<LearningReflection> => {
    try {
      const raw = await modelFactory()
        .withStructuredOutput(learningReflectionSchema)
        .invoke([
          ["system", LEARNING_REFLECTOR_PROMPT],
          ["user", userMessage],
        ]);
      return learningReflectionSchema.parse(raw);
    } catch {
      return NO_LEARNING;
    }
  };
}

export async function scheduleLearning(args: {
  reflector: LearningReflectorFn;
  memories: MemoryStore;
  userId: string;
  userMessage: string;
}): Promise<void> {
  try {
    const reflection = await args.reflector(args.userMessage);
    if (!reflection.hasLearning) {
      return;
    }
    const fact = reflection.fact.trim();
    if (fact.length === 0) {
      return;
    }
    await args.memories.remember(args.userId, fact);
  } catch {
    // Best-effort: never break the chat turn.
  }
}

/**
 * Persist durable learning before recall so the same turn can use the new fact.
 * For plantão-organization asks, await the reflector; otherwise fire-and-forget.
 */
export async function prepareMemoriesForTurn(args: {
  reflector?: LearningReflectorFn;
  memories: MemoryStore;
  userId: string;
  userMessage: string;
}): Promise<RecalledMemory[]> {
  const query = buildMemoryRecallQuery(args.userMessage);

  if (!args.reflector) {
    return args.memories.recall(args.userId, query);
  }

  if (suggestsPlantaoOrganization(args.userMessage)) {
    await scheduleLearning({
      reflector: args.reflector,
      memories: args.memories,
      userId: args.userId,
      userMessage: args.userMessage,
    });
  } else {
    void scheduleLearning({
      reflector: args.reflector,
      memories: args.memories,
      userId: args.userId,
      userMessage: args.userMessage,
    }).catch(() => {
      /* fail-safe */
    });
  }

  return args.memories.recall(args.userId, query);
}
