# Quickstart & Validation Guide: OpsPilot Reasoning Nucleus

**Phase 1 output for** `specs/001-reasoning-nucleus/plan.md`

This guide describes how to validate that each acceptance scenario and success criterion works end-to-end. It is **not** an implementation guide — for entity definitions see [data-model.md](./data-model.md), for tool schemas see [contracts/tools.md](./contracts/tools.md), and for the arena CLI interface see [contracts/arena-cli.md](./contracts/arena-cli.md).

---

## Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Create .env with your OpenRouter key
echo "OPENROUTER_API_KEY=sk-or-..." > .env

# 3. Verify TypeScript compiles
npm run typecheck
```

---

## Validation 1 — Unit tests (no network)

These tests must pass in CI and locally without any network calls.

```bash
npm test
```

**Expected outcome**:
- All tests in `src/store/in-memory-store.test.ts` pass (CRUD operations, seed data shape)
- All tests in `src/trace/builder.test.ts` pass (TraceEvent construction from message arrays)
- Exit code `0`

**Covers**: SC-004, SC-006

---

## Validation 2 — Typecheck

```bash
npm run typecheck
```

**Expected outcome**: No TypeScript errors. Exit code `0`.

---

## Validation 3 — List active alerts (User Story 1)

```bash
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --input "Quais alertas estão ativos?"
```

**Expected outcome**:
- Trace contains a `[thought]` event, a `[action] list_alerts({"status":"firing"})` event, a `[observation]` with 3 alerts, and a `[answer]` event
- Answer mentions `payment-api`, `auth-service`, and `order-service`
- Answer does **not** mention `inventory-api`, `notification-worker`, or `payment-api` resolved alerts
- Metrics show `llmCalls ≥ 1` and `latencyMs < 30000`

**Covers**: User Story 1 — Scenario 1, FR-001, FR-002, FR-003, SC-001, SC-002

---

## Validation 4 — No active alerts scenario (User Story 1, Scenario 2)

> This scenario requires a modified store with all alerts `resolved`. The easiest way is to write a small one-off script or temporarily modify `seed.ts` to set all statuses to `resolved`.

```bash
# After modifying seed to set all alerts to resolved:
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --input "Quais alertas estão ativos?"
```

**Expected outcome**: Answer states there are no active alerts; no `payment-api`, `auth-service`, or `order-service` mentioned in an alert context.

**Covers**: User Story 1 — Scenario 2

---

## Validation 5 — Open and resolve an incident (User Story 2)

```bash
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --input "Abra um incidente crítico para o serviço payment-api chamado 'Alta taxa de erros'"
```

**Expected outcome**:
- Trace contains `[action] open_incident({"title":"Alta taxa de erros","service":"payment-api","severity":"critical"})`
- Answer confirms the incident was created and includes the generated ID (e.g., `inc-...`)

```bash
# Use the ID from the previous run:
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --input "Resolva o incidente inc-XXXX"
```

**Expected outcome**:
- Trace contains `[action] resolve_incident({"id":"inc-XXXX"})`
- Answer confirms the incident was resolved

**Covers**: User Story 2 — Scenarios 1 and 2, FR-007, FR-008

---

## Validation 6 — Resolve non-existent incident (User Story 2, Scenario 3)

```bash
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --input "Resolva o incidente inc-nao-existe"
```

**Expected outcome**:
- Agent reports that the incident was not found
- Process exits with code `0` (agent handled the error gracefully, no uncaught exception)

**Covers**: User Story 2 — Scenario 3, FR-008

---

## Validation 7 — Arena with both strategies (User Story 3)

```bash
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react,plan-and-execute \
  --input "Quais serviços têm alertas ativos?"
```

**Expected outcome**:
- Two strategy blocks printed: one for `react`, one for `plan-and-execute`
- Each block shows its own trace and metrics
- Plan-and-Execute trace includes at least one `[plan]` event
- Both strategies produce an `[answer]` event
- Exit code `0`

**Covers**: User Story 3 — Scenarios 1 and 3, FR-014, SC-003

---

## Validation 8 — Max iterations cap (User Story 3, Scenario 2)

```bash
node --env-file .env node_modules/.bin/tsx src/arena.ts \
  --strategies react \
  --max-iterations 3 \
  --input "Quais serviços têm alertas ativos e incidentes abertos? Lista tudo em detalhes."
```

**Expected outcome**:
- If the query requires more than 3 iterations, the trace ends with an `[answer]` event containing an iteration-limit message
- Process does **not** hang; exits within a reasonable time
- Exit code `0` (iteration limit is handled, not an error)

**Covers**: User Story 3 — Scenario 2, FR-013, SC-005

---

## Validation 9 — Typed trace events (User Story 4)

Run any of the above arena commands and inspect the trace output:

**ReAct trace checks**:
- First non-human event is `[thought]` or `[action]`
- Last event is `[answer]`
- Every `[action]` line shows the tool name and arguments

**Plan-and-Execute trace checks**:
- Contains at least one `[plan]` event with a list of steps
- Contains `[action]`/`[observation]` pairs for executed steps
- Ends with `[answer]`

**Covers**: User Story 4 — all scenarios, FR-002, SC-002

---

## Validation 10 — Missing API key (Edge Case)

```bash
# Do NOT pass --env-file or set OPENROUTER_API_KEY
tsx src/arena.ts --strategies react --input "test"
```

**Expected outcome**:
- Process exits immediately with: `Error: OPENROUTER_API_KEY environment variable is required`
- Exit code non-zero

**Covers**: Edge case "OPENROUTER_API_KEY not configured"
