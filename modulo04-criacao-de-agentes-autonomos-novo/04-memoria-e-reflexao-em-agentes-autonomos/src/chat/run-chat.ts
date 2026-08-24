import type {
  ConversationMessage,
  ConversationStore,
  ExecutionMetrics,
  MemoryStore,
  ReasoningStrategy,
  RecalledMemory,
  StrategyResult,
  TraceEvent,
} from "../domain/types.js";
import { runWithChatUser } from "../memory/chat-user-context.js";
import {
  scheduleLearning,
  type LearningReflectorFn,
} from "../memory/learning-reflector.js";

/** Max prior messages injected into a strategy turn. */
export const HISTORY_LIMIT = 12;

export interface ChatInput {
  message: string;
  userId: string;
  conversationId?: string;
}

export interface ChatTurnResult {
  conversationId: string;
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics & { historyMessages: number; recalledMemories: number };
}

export interface RunChatOptions {
  /** Wrap the strategy promise (e.g. HTTP timeout). Defaults to identity. */
  execute?: (promise: Promise<StrategyResult>) => Promise<StrategyResult>;
  /** Optional post-turn learning reflector (async remember; does not block return). */
  learningReflector?: LearningReflectorFn;
}

/** Inject recalled facts into the user message (strategies stay unchanged). */
export function formatMemoriesForPrompt(
  recalled: RecalledMemory[],
  currentMessage: string,
): string {
  if (recalled.length === 0) {
    return currentMessage;
  }
  const lines = recalled.map((m) => `- ${m.fact}`);
  return `Relevant memories:\n${lines.join("\n")}\n\nCurrent message:\n${currentMessage}`;
}

/**
 * Persist turn + run strategy with history and semantic memory.
 * Flow: create/load → lastMessages(12) → recall → append user → run(enriched) → append assistant
 * → scheduleLearning (fire-and-forget).
 */
export async function runChat(
  conversations: ConversationStore,
  memories: MemoryStore,
  strategy: ReasoningStrategy,
  input: ChatInput,
  options: RunChatOptions = {},
): Promise<ChatTurnResult> {
  const conversationId = input.conversationId ?? conversations.create();
  const history = conversations.lastMessages(conversationId, HISTORY_LIMIT);
  const recalled = await memories.recall(input.userId, input.message);
  const enrichedMessage = formatMemoriesForPrompt(recalled, input.message);

  conversations.append(conversationId, "user", input.message);

  const result = await runWithChatUser(input.userId, async () => {
    const runPromise = strategy.run({ message: enrichedMessage, history });
    return options.execute?.(runPromise) ?? runPromise;
  });

  conversations.append(conversationId, "assistant", result.answer);

  if (options.learningReflector) {
    void scheduleLearning({
      reflector: options.learningReflector,
      memories,
      userId: input.userId,
      userMessage: input.message,
    }).catch(() => {
      /* already fail-safe inside scheduleLearning */
    });
  }

  return {
    conversationId,
    answer: result.answer,
    trace: result.trace,
    metrics: {
      ...result.metrics,
      historyMessages: history.length,
      recalledMemories: recalled.length,
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
