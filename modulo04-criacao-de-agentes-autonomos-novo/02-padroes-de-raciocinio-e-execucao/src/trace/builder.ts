import { AIMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";

import type { TraceEvent } from "../domain/types.js";

function toText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return JSON.stringify(item);
      })
      .join(" ")
      .trim();
  }
  return String(content ?? "");
}

export function buildTraceFromMessages(messages: BaseMessage[]): TraceEvent[] {
  const trace: TraceEvent[] = [];

  for (const message of messages) {
    if (message instanceof AIMessage) {
      const content = toText(message.content).trim();
      if (message.tool_calls && message.tool_calls.length > 0) {
        if (content.length > 0) {
          trace.push({ type: "thought", content });
        }

        for (const call of message.tool_calls) {
          trace.push({
            type: "action",
            content: `${call.name}(${JSON.stringify(call.args ?? {})})`,
            tool: call.name,
            toolArgs: (call.args as Record<string, unknown>) ?? {},
          });
        }
      } else if (content.length > 0) {
        trace.push({ type: "answer", content });
      }
      continue;
    }

    if (message instanceof ToolMessage) {
      const content = toText(message.content).trim();
      trace.push({ type: "observation", content });
    }
  }

  const hasAnswer = trace.some((event) => event.type === "answer");
  if (!hasAnswer) {
    trace.push({ type: "answer", content: "No answer generated." });
  }

  return trace;
}

export function buildPlanExecuteTrace(events: TraceEvent[]): TraceEvent[] {
  const allowed = new Set(["plan", "action", "observation", "critique", "answer"]);
  const filtered = events.filter((event) => allowed.has(event.type));
  if (filtered.length === 0 || filtered[filtered.length - 1]?.type !== "answer") {
    filtered.push({ type: "answer", content: "No final answer generated." });
  }
  return filtered;
}
