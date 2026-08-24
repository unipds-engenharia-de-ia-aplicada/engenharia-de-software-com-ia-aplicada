import type {
  ConversationMessage,
  ConversationStore,
  ExecutionMetrics,
  ReasoningStrategy,
  StrategyResult,
  TraceEvent,
} from "../domain/types.js";

/** Max prior messages injected into a strategy turn. */
export const HISTORY_LIMIT = 12;

export interface ChatInput {
  message: string;
  conversationId?: string;
}

export interface ChatTurnResult {
  conversationId: string;
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics & { historyMessages: number };
}

export interface RunChatOptions {
  /** Wrap the strategy promise (e.g. HTTP timeout). Defaults to identity. */
  execute?: (promise: Promise<StrategyResult>) => Promise<StrategyResult>;
}

/**
 * Persist turn + run strategy with history.
 * Matches: create/load → lastMessages(12) → append user → run → append assistant.
 */
export async function runChat(
  conversations: ConversationStore,
  strategy: ReasoningStrategy,
  input: ChatInput,
  options: RunChatOptions = {},
): Promise<ChatTurnResult> {
  const conversationId = input.conversationId ?? conversations.create();
  const history = conversations.lastMessages(conversationId, HISTORY_LIMIT);

  conversations.append(conversationId, "user", input.message);

  const runPromise = strategy.run({ message: input.message, history });
  const result = await (options.execute?.(runPromise) ?? runPromise);

  conversations.append(conversationId, "assistant", result.answer);

  return {
    conversationId,
    answer: result.answer,
    trace: result.trace,
    metrics: {
      ...result.metrics,
      historyMessages: history.length,
    },
  };
}

/** Format history for strategies that still consume a single text blob (e.g. plan-execute). */
export function formatHistoryForPrompt(
  history: ConversationMessage[],
  currentMessage: string,
): string {
  if (history.length === 0) {
    return currentMessage;
  }
  const lines = history.map((m) => `${m.role}: ${m.content}`);
  return `Previous conversation:\n${lines.join("\n")}\n\nCurrent message:\n${currentMessage}`;
}
