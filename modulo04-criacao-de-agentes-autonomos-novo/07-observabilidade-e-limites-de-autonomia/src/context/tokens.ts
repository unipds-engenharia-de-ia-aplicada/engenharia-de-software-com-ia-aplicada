import type { ContextBreakdown } from "../domain/types.js";

export type { ContextBreakdown };

export interface LlmUsage {
  promptTokens: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Canonical estimate: Math.floor(chars / 4). */
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function nonNegInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function usageFromParts(
  prompt: unknown,
  completion: unknown,
  total: unknown,
): LlmUsage | undefined {
  const promptTokens = nonNegInt(prompt);
  if (promptTokens === undefined) {
    return undefined;
  }
  const usage: LlmUsage = { promptTokens };
  const completionTokens = nonNegInt(completion);
  if (completionTokens !== undefined) {
    usage.completionTokens = completionTokens;
  }
  const totalTokens = nonNegInt(total);
  if (totalTokens !== undefined) {
    usage.totalTokens = totalTokens;
  }
  return usage;
}

/**
 * Defensive parse of LangChain / OpenAI-style usage.
 * Prefer usage_metadata → response_metadata.tokenUsage → flat aliases.
 * Never throws.
 */
export function readLlmUsage(source: unknown): LlmUsage | undefined {
  try {
    const root = asRecord(source);
    if (!root) {
      return undefined;
    }

    const usageMeta = asRecord(root.usage_metadata);
    if (usageMeta) {
      const fromMeta = usageFromParts(
        usageMeta.input_tokens,
        usageMeta.output_tokens,
        usageMeta.total_tokens,
      );
      if (fromMeta) {
        return fromMeta;
      }
    }

    const responseMeta = asRecord(root.response_metadata);
    const tokenUsage =
      asRecord(responseMeta?.tokenUsage) ??
      asRecord(responseMeta?.token_usage) ??
      asRecord(root.tokenUsage) ??
      asRecord(root.token_usage);
    if (tokenUsage) {
      const fromTokenUsage = usageFromParts(
        tokenUsage.promptTokens ?? tokenUsage.prompt_tokens,
        tokenUsage.completionTokens ?? tokenUsage.completion_tokens,
        tokenUsage.totalTokens ?? tokenUsage.total_tokens,
      );
      if (fromTokenUsage) {
        return fromTokenUsage;
      }
    }

    return usageFromParts(
      root.promptTokens ?? root.prompt_tokens ?? root.input_tokens,
      root.completionTokens ?? root.completion_tokens ?? root.output_tokens,
      root.totalTokens ?? root.total_tokens,
    );
  } catch {
    return undefined;
  }
}

/**
 * Sum prompt tokens from messages that expose usage (e.g. AIMessage[]).
 * Returns undefined if no message contributes.
 */
export function sumPromptTokensFromMessages(
  messages: Iterable<unknown>,
): number | undefined {
  let sum = 0;
  let contributions = 0;
  for (const message of messages) {
    const usage = readLlmUsage(message);
    if (usage) {
      sum += usage.promptTokens;
      contributions += 1;
    }
  }
  return contributions > 0 ? sum : undefined;
}

/** Aggregate optional prompt-token totals (undefined = unknown / omit). */
export function addPromptTokens(
  current: number | undefined,
  next: number | undefined,
): number | undefined {
  if (next === undefined) {
    return current;
  }
  if (current === undefined) {
    return next;
  }
  return current + next;
}

export function buildContextBreakdown(parts: {
  system: string;
  history: string;
  memories: string;
  message: string;
  summary?: string;
}): ContextBreakdown {
  return {
    system: estimateTokens(parts.system),
    history: estimateTokens(parts.history),
    memories: estimateTokens(parts.memories),
    message: estimateTokens(parts.message),
    summary: estimateTokens(parts.summary ?? ""),
  };
}
