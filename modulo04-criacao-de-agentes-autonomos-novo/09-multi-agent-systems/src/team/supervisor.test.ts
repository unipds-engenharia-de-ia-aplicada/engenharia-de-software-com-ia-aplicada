import assert from "node:assert/strict";
import test from "node:test";

import { SUPERVISOR_SYSTEM_PROMPT } from "./supervisor-prompt.js";
import { supervisorDecisionSchema, TEAM_ROLES } from "./supervisor.js";

test("supervisor schema accepts valid decisions for every role and done", () => {
  for (const next of [...TEAM_ROLES, "done"]) {
    const parsed = supervisorDecisionSchema.parse({ next, brief: "faça X" });
    assert.equal(parsed.next, next);
    assert.equal(parsed.brief, "faça X");
  }
});

test("supervisor schema rejects unknown next and missing brief", () => {
  assert.throws(() =>
    supervisorDecisionSchema.parse({ next: "gerente", brief: "x" }),
  );
  assert.throws(() => supervisorDecisionSchema.parse({ next: "analista" }));
});

test("supervisor prompt table lists all roles, done and the cap", () => {
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /analista/);
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /planejador/);
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /executor/);
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /done/);
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /Tabela de papéis/);
  assert.match(SUPERVISOR_SYSTEM_PROMPT, /teto de 8/);
});
