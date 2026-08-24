import type { ChatOpenAI } from "@langchain/openai";

import { estimateTokens } from "../context/tokens.js";
import type {
  ConversationMessage,
  ConversationStore,
  TraceEvent,
} from "../domain/types.js";

/** Max prior messages injected raw into a strategy turn. */
export const HISTORY_LIMIT = 8;

/** Messages per summarize batch (must leave the recent window before trigger). */
export const SUMMARY_BATCH_SIZE = 8;

/** Soft target for summary size (chars/4 estimate). */
export const SUMMARY_TOKEN_TARGET = 150;

export const SUMMARIZER_PROMPT = `Comprima o trecho de conversa a seguir em no máximo 150 tokens, preservando obrigatoriamente: decisões tomadas, fatos estabelecidos (nomes, datas, prazos, preferências), incidentes abertos/resolvidos e pendências abertas. Descarte cumprimentos e conversa social. Se houver um resumo anterior, incorpore-o. Responda só o resumo, em tópicos telegráficos`;

export type ConversationSummarizer = (input: {
  previousSummary: string | null;
  batch: ConversationMessage[];
}) => Promise<string>;

export function formatSummaryForPrompt(
  summary: string | null | undefined,
  body: string,
): string {
  const trimmed = summary?.trim() ?? "";
  if (trimmed.length === 0) {
    return body;
  }
  return `Conversation summary:\n${trimmed}\n\n${body}`;
}

/** Deterministic fake for tests; truncates to ~SUMMARY_TOKEN_TARGET tokens. */
export function createFakeConversationSummarizer(
  onCall?: (input: {
    previousSummary: string | null;
    batch: ConversationMessage[];
  }) => void,
): ConversationSummarizer {
  return async (input) => {
    onCall?.(input);
    const prev = input.previousSummary ?? "";
    const batchPart = input.batch.map((m) => m.content).join(";");
    const raw = `merge(${prev})|batch:${batchPart}`;
    const maxChars = SUMMARY_TOKEN_TARGET * 4;
    return raw.length <= maxChars ? raw : raw.slice(0, maxChars);
  };
}

export function createLLMConversationSummarizer(
  modelFactory: () => ChatOpenAI,
): ConversationSummarizer {
  return async ({ previousSummary, batch }) => {
    const batchText = batch.map((m) => `${m.role}: ${m.content}`).join("\n");
    const userContent = [
      previousSummary?.trim()
        ? `Resumo anterior:\n${previousSummary.trim()}`
        : "Resumo anterior: (nenhum)",
      `Trecho a comprimir:\n${batchText}`,
    ].join("\n\n");

    const result = await modelFactory().invoke([
      ["system", SUMMARIZER_PROMPT],
      ["user", userContent],
    ]);
    const content = result.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
              .join("")
          : String(content);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("empty summarizer output");
    }
    return trimmed;
  };
}

/**
 * If ≥ SUMMARY_BATCH_SIZE messages have left the recent window since watermark,
 * summarize the next contiguous batch (max one batch per call). Fail-safe.
 */
export async function maybeSummarize(args: {
  conversations: ConversationStore;
  conversationId: string;
  summarizer: ConversationSummarizer;
}): Promise<{ summaryText: string; event: TraceEvent } | null> {
  try {
    const { conversations, conversationId, summarizer } = args;
    const total = conversations.countMessages(conversationId);
    const existing = conversations.getSummary(conversationId);
    const covered = existing?.coveredCount ?? 0;
    const outside = Math.max(0, total - HISTORY_LIMIT);
    const pending = outside - covered;

    if (pending < SUMMARY_BATCH_SIZE) {
      return null;
    }

    const batch = conversations.messagesAscending(
      conversationId,
      covered,
      SUMMARY_BATCH_SIZE,
    );
    if (batch.length < SUMMARY_BATCH_SIZE) {
      return null;
    }

    const summaryText = (await summarizer({
      previousSummary: existing?.text ?? null,
      batch,
    })).trim();

    if (summaryText.length === 0) {
      return null;
    }

    // Soft enforce target for oversized outputs (esp. LLM).
    const maxChars = SUMMARY_TOKEN_TARGET * 4;
    const stored =
      estimateTokens(summaryText) <= SUMMARY_TOKEN_TARGET
        ? summaryText
        : summaryText.slice(0, maxChars);

    const nextCovered = covered + SUMMARY_BATCH_SIZE;
    conversations.upsertSummary(conversationId, stored, nextCovered);

    return {
      summaryText: stored,
      event: { type: "summarize", content: stored },
    };
  } catch {
    return null;
  }
}
