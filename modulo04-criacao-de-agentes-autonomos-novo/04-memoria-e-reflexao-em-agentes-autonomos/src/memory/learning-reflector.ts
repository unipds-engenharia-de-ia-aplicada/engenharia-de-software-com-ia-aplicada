import type { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import type { MemoryStore } from "../domain/types.js";

export const LEARNING_REFLECTOR_PROMPT = [
  "Você destila APRENDIZADOS DURÁVEIS da mensagem do usuário para memória de longo prazo de um copiloto de plantão (OpsPilot).",
  "hasLearning=true SOMENTE se a mensagem contiver preferência ou fato operacional DURÁVEL (ex.: \"sempre priorize o serviço checkout\", \"prefiro resumos curtos\").",
  "hasLearning=false para pedidos PONTUAIS one-shot (ex.: \"liste alertas\", \"abra um incidente\", \"resolva X agora\", perguntas efêmeras de status).",
  "hasLearning=false se a mensagem contiver SEGREDOS ou dados sensíveis (senhas, tokens, API keys, credenciais, secrets).",
  "Quando hasLearning=true, fact deve ser um enunciado estável em uma frase (não copie o pedido pontual bruto).",
  "Quando hasLearning=false, fact deve ser string vazia.",
].join(" ");

export const learningReflectionSchema = z.object({
  hasLearning: z
    .boolean()
    .describe(
      "true somente se a mensagem contiver preferência ou fato operacional DURÁVEL elegível a memória (nunca pedido pontual, nunca segredo)",
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

export function createLLMLearningReflector(
  modelFactory: () => ChatOpenAI,
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
