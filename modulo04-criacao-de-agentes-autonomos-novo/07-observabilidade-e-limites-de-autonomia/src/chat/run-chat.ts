import { OPSPILOT_SYSTEM_PROMPT } from "../agents/system-prompt.js";
import type {
  ContextBreakdown,
  ConversationMessage,
  ConversationStore,
  ExecutionMetrics,
  MemoryStore,
  ReasoningStrategy,
  StrategyResult,
  TraceEvent,
} from "../domain/types.js";
import { runWithChatUser } from "../memory/chat-user-context.js";
import {
  scheduleLearning,
  type LearningReflectorFn,
} from "../memory/learning-reflector.js";
import {
  buildContext,
  formatHistoryText,
  formatMemoriesForPrompt,
  formatMemoriesText,
  type SectionBudgets,
} from "../context/context-builder.js";
import { buildContextBreakdown } from "../context/tokens.js";
import {
  HISTORY_LIMIT,
  maybeSummarize,
  type ConversationSummarizer,
} from "./history-summarizer.js";

export { HISTORY_LIMIT };
export { formatMemoriesForPrompt, formatHistoryText, formatMemoriesText };

export interface ChatInput {
  message: string;
  userId: string;
  conversationId?: string;
}

export interface ChatTurnResult {
  conversationId: string;
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics & {
    historyMessages: number;
    recalledMemories: number;
    contextBreakdown: ContextBreakdown;
  };
}

export interface RunChatOptions {
  /** Wrap the strategy promise (e.g. HTTP timeout). Defaults to identity. */
  execute?: (promise: Promise<StrategyResult>) => Promise<StrategyResult>;
  /** Optional post-turn learning reflector (async remember; does not block return). */
  learningReflector?: LearningReflectorFn;
  /** Optional history summarizer (batch prune). Absent → window only, no summarize. */
  summarizer?: ConversationSummarizer;
  /** Optional per-section token budgets (tests / overrides). */
  budgets?: Partial<SectionBudgets>;
}

/**
 * Persist turn + run strategy with history, optional summary prune, and semantic memory.
 * Flow: create/load → maybeSummarize → lastMessages(8) → recall → buildContext → append user
 * → run → append assistant → scheduleLearning.
 */
export async function runChat(
  conversations: ConversationStore,
  memories: MemoryStore,
  strategy: ReasoningStrategy,
  input: ChatInput,
  options: RunChatOptions = {},
): Promise<ChatTurnResult> {
  const conversationId = input.conversationId ?? conversations.create();

  let summarizeEvent: TraceEvent | undefined;
  if (options.summarizer) {
    const summarized = await maybeSummarize({
      conversations,
      conversationId,
      summarizer: options.summarizer,
    });
    if (summarized) {
      summarizeEvent = summarized.event;
    }
  }

  const history = conversations.lastMessages(conversationId, HISTORY_LIMIT);
  const summaryRecord = conversations.getSummary(conversationId);
  const summaryText = summaryRecord?.text ?? null;
  const recalled = await memories.recall(input.userId, input.message);

  const built = buildContext(
    {
      system: OPSPILOT_SYSTEM_PROMPT,
      summary: summaryText,
      history,
      memories: recalled,
      message: input.message,
    },
    { budgets: options.budgets },
  );

  conversations.append(conversationId, "user", input.message);

  const result = await runWithChatUser(input.userId, async () => {
    const runPromise = strategy.run({
      message: built.enrichedMessage,
      history: built.history,
    });
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

  const contextBreakdown = buildContextBreakdown({
    system: built.system,
    history: built.historyText,
    memories: built.memoriesText,
    message: built.message,
    summary: built.summaryText,
  });

  const metrics: ChatTurnResult["metrics"] = {
    ...result.metrics,
    historyMessages: built.historyMessages,
    recalledMemories: built.recalledMemories,
    contextBreakdown,
  };
  if (result.metrics.promptTokens === undefined) {
    delete metrics.promptTokens;
  }

  const trace = summarizeEvent ? [summarizeEvent, ...result.trace] : result.trace;

  return {
    conversationId,
    answer: result.answer,
    trace,
    metrics,
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
