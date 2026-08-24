import { AIMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { GraphRecursionError } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";

import type { ReasoningStrategy, StrategyResult, StrategyRunInput } from "../domain/types.js";
import { buildTraceFromMessages } from "../trace/builder.js";
import { OPSPILOT_SYSTEM_PROMPT } from "./system-prompt.js";

interface ReactStrategyOptions {
  modelFactory: () => ChatOpenAI;
  tools: DynamicStructuredTool[];
  maxIterations: number;
}

export class ReactStrategy implements ReasoningStrategy {
  readonly name = "react";
  private readonly modelFactory: () => ChatOpenAI;
  private readonly tools: DynamicStructuredTool[];
  private readonly maxIterations: number;

  constructor(options: ReactStrategyOptions) {
    this.modelFactory = options.modelFactory;
    this.tools = options.tools;
    this.maxIterations = options.maxIterations;
  }

  async run(input: StrategyRunInput): Promise<StrategyResult> {
    const startedAt = Date.now();
    const model = this.modelFactory();
    const agent = createReactAgent({
      llm: model,
      tools: this.tools,
      prompt: OPSPILOT_SYSTEM_PROMPT,
    });

    try {
      const messages = [
        ...input.history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user" as const, content: input.message },
      ];
      const result = await agent.invoke(
        { messages },
        { recursionLimit: Math.max(3, this.maxIterations * 3) },
      );
      const trace = buildTraceFromMessages(result.messages);
      const answer = trace.filter((item) => item.type === "answer").at(-1)?.content ?? "No answer generated.";
      const llmCalls = result.messages.filter((message) => message instanceof AIMessage).length;

      return {
        answer,
        trace,
        metrics: {
          llmCalls,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof GraphRecursionError) {
        const answer = `[Iteration limit reached after ${this.maxIterations} steps. Partial result unavailable.]`;
        return {
          answer,
          trace: [{ type: "answer", content: answer }],
          metrics: {
            llmCalls: 0,
            latencyMs: Date.now() - startedAt,
          },
        };
      }
      throw error;
    }
  }
}
