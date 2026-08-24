import test from "node:test";
import assert from "node:assert/strict";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

import { buildPlanExecuteTrace, buildTraceFromMessages } from "./builder.js";

test("buildTraceFromMessages creates thought->action->observation->answer sequence", () => {
  const messages = [
    new HumanMessage("Quais alertas estão ativos?"),
    new AIMessage({
      content: "Vou consultar os alertas ativos.",
      tool_calls: [{ id: "call_1", type: "tool_call", name: "list_alerts", args: { status: "firing" } }],
    }),
    new ToolMessage({ tool_call_id: "call_1", content: "Found 3 firing alert(s): ..." }),
    new AIMessage({ content: "Há três serviços com alertas ativos." }),
  ];

  const trace = buildTraceFromMessages(messages);
  assert.deepEqual(trace.map((event) => event.type), ["thought", "action", "observation", "answer"]);
  assert.equal(trace[1]?.tool, "list_alerts");
  assert.deepEqual(trace[1]?.toolArgs, { status: "firing" });
  assert.equal(trace.at(-1)?.type, "answer");
});

test("buildTraceFromMessages keeps action tool and args", () => {
  const trace = buildTraceFromMessages([
    new AIMessage({
      content: "Vou abrir um incidente.",
      tool_calls: [
        {
          id: "call_open",
          type: "tool_call",
          name: "open_incident",
          args: { title: "Alta taxa", service: "payment-api", severity: "critical" },
        },
      ],
    }),
    new ToolMessage({ tool_call_id: "call_open", content: "Incident created successfully. ID: inc-1" }),
    new AIMessage({ content: "Incidente criado." }),
  ]);

  const action = trace.find((event) => event.type === "action");
  assert.equal(action?.tool, "open_incident");
  assert.deepEqual(action?.toolArgs, {
    title: "Alta taxa",
    service: "payment-api",
    severity: "critical",
  });
});

test("buildPlanExecuteTrace supports baseline plan->action->observation->answer", () => {
  const trace = buildPlanExecuteTrace([
    { type: "plan", content: "1. List alerts" },
    { type: "action", content: "list_alerts", tool: "list_alerts", toolArgs: { status: "firing" } },
    { type: "observation", content: "Found 3 firing alert(s)" },
    { type: "answer", content: "Serviços com alertas: payment-api, auth-service, order-service" },
  ]);

  assert.deepEqual(trace.map((event) => event.type), ["plan", "action", "observation", "answer"]);
});

test("buildPlanExecuteTrace supports replanning with critique", () => {
  const trace = buildPlanExecuteTrace([
    { type: "plan", content: "1. Check alerts" },
    { type: "action", content: "list_alerts", tool: "list_alerts", toolArgs: { status: "firing" } },
    { type: "observation", content: "Found 3 firing alert(s)" },
    { type: "critique", content: "1. Open incident for payment-api" },
    { type: "action", content: "open_incident", tool: "open_incident", toolArgs: { service: "payment-api" } },
    { type: "observation", content: "Incident created" },
    { type: "answer", content: "Incidente aberto com sucesso." },
  ]);

  assert.deepEqual(trace.map((event) => event.type), [
    "plan",
    "action",
    "observation",
    "critique",
    "action",
    "observation",
    "answer",
  ]);
  for (const event of trace.filter((item) => item.type === "action")) {
    assert.ok(event.tool);
    assert.ok(event.toolArgs);
  }
});
