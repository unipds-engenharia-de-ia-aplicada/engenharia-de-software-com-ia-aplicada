# Tasks: Grafo Unificado de Produção

**Input**: Design documents from `/specs/013-unified-production-graph/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-013 / SC-001–SC-005; grafo com fakes; override; `route` + `node`; `422`; sem rede LLM

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold do módulo `src/graph/` sem lógica de orquestração ainda

- [x] T001 Create `src/graph/stamp-node.ts` exporting `stampNode(node: string, events: TraceEvent[]): TraceEvent[]` (identity stub ok until foundational types land)
- [x] T002 [P] Create `src/graph/router-prompt.ts` exporting `ROUTER_DECISION_TABLE` / `ROUTER_SYSTEM_PROMPT` string constants (table with `react` | `plan-and-execute` | `reflect` per research)
- [x] T003 [P] Create `src/graph/router.ts` with exported stubs: `routeSchema`, `ProductionRoute`, `RouterDecision`, `classifyRoute(...)` (throw or return fixed `{ route: "react", reason: "stub" }`)
- [x] T004 [P] Create `src/graph/production-graph.ts` with exported stubs: `createProductionGraph`, `runProductionTurn` (throw `not implemented`)
- [x] T005 [P] Create `src/graph/production-graph.test.ts` with a single smoke import so `npm test` picks up the file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domínio de trace + helpers + tipos de rota — **BLOCKS** all user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T006 Extend `TraceEventType` with `"route"` and make `TraceEvent.node: string` required; add optional `route?: string` and `override?: boolean` in `src/domain/types.ts` per `contracts/trace.md`
- [x] T007 Implement `stampNode` in `src/graph/stamp-node.ts` (map events setting/overwriting `node`)
- [x] T008 Update `buildTraceFromMessages` / `buildPlanExecuteTrace` in `src/trace/builder.ts` to accept `node: string` and stamp every emitted event
- [x] T009 [P] Define `ProductionRoute` enum/union + `routeSchema` (`z.object({ route: z.enum([...]), reason: z.string().min(1) })`) in `src/graph/router.ts`
- [x] T010 [P] Fill `ROUTER_DECISION_TABLE` markdown table + full system prompt in `src/graph/router-prompt.ts` (assertable string contains all three route names)
- [x] T011 Fix compile breakages from required `node`: stamp strategy name (or `"arena"`) at emission sites in `src/agents/react.ts`, `src/strategies/plan-execute.ts`, `src/strategies/reflect.ts`, `src/chat/history-summarizer.ts`, and any test helpers constructing `TraceEvent` — minimal stamp only; US4 hardens coverage
- [x] T012 Run `npm run typecheck` and fix remaining `TraceEvent` literal misses across `src/**/*.ts`

**Checkpoint**: Tipos + helpers prontos; stories podem começar

---

## Phase 3: User Story 1 — Um Único Grafo Orquestra o Turno (Priority: P1) 🎯 MVP

**Goal**: `production-graph.ts` executa `context → router → uma strategy → response` e o caminho `/chat` usa esse grafo (não `resolveStrategy` + default `react` isolado)

**Independent Test**: Harness com strategies fake + router injetável fixo; `runProductionTurn` devolve `{ answer, trace, metrics, conversationId }` após exatamente um nó de strategy

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T013 [P] [US1] Test: graph runs context → fixed route → `react` fake → response; conversation append user/assistant in `src/graph/production-graph.test.ts`
- [x] T014 [P] [US1] Test: conditional edge executes only the selected strategy node among three fakes in `src/graph/production-graph.test.ts`

### Implementation for User Story 1

- [x] T015 [US1] Implement LangGraph `StateGraph` state annotations in `src/graph/production-graph.ts` per `data-model.md` (`message`, `userId`, `conversationId`, `built`, `route`, `trace` reducer, `answer`, `metrics`, `overrideRoute`, …)
- [x] T016 [US1] Implement `context` node in `src/graph/production-graph.ts`: `maybeSummarize` → `lastMessages` → `recall` → `buildContext` → append user; stamp `summarize` with `node: "context"` when present
- [x] T017 [US1] Implement strategy nodes (`react`, `plan-and-execute`, `reflect`) in `src/graph/production-graph.ts` that call injected `ReasoningStrategy.run` with built context and `stampNode` on returned trace
- [x] T018 [US1] Implement `response` node in `src/graph/production-graph.ts`: append assistant, `scheduleLearning`, assemble `ChatTurnResult` metrics/`contextBreakdown` (reuse `runChat` logic)
- [x] T019 [US1] Implement stub/injectable router path for MVP: if `overrideRoute` set use it; else use injected `classifyRoute` dep (tests pass fake returning fixed route) — full LLM router in US2
- [x] T020 [US1] Wire edges `START→context→router→conditional(route)→strategy→response→END` and export `createProductionGraph` / `runProductionTurn` in `src/graph/production-graph.ts`
- [x] T021 [US1] Refactor `src/chat/run-chat.ts` and/or `src/http/server.ts` to invoke `runProductionTurn` instead of `resolveStrategy` + bare `strategy.run`; keep timeout wrapper around the full turn
- [x] T022 [US1] Update `src/index.ts` bootstrap to build reflect strategy via `withReflection(react)` and pass all three strategies + `routeModelFactory` into graph deps

**Checkpoint**: MVP — turno `/chat` orquestrado pelo grafo com router injetável

---

## Phase 4: User Story 2 — Roteador Classifica Automaticamente (Priority: P1)

**Goal**: Sem `strategy` no body, o nó router usa `withStructuredOutput({ route, reason })` + tabela no prompt e emite evento `type: "route"`

**Independent Test**: Classificador fake/determinístico devolve `{ route, reason }`; trace contém evento `route` com `node: "router"`; strategy correspondente executa

### Tests for User Story 2

- [x] T023 [P] [US2] Test: `ROUTER_SYSTEM_PROMPT` / table includes all three routes in `src/graph/production-graph.test.ts` (or small `router-prompt` assert)
- [x] T024 [P] [US2] Test: fake classifier → `plan-and-execute` emits `{ type:"route", node:"router", route, override:false }` and runs that node in `src/graph/production-graph.test.ts`
- [x] T025 [P] [US2] Test: invalid/throwing classifier falls back to `react` with reason mentioning fallback in `src/graph/production-graph.test.ts`

### Implementation for User Story 2

- [x] T026 [US2] Implement `classifyRoute` in `src/graph/router.ts` using `modelFactory().withStructuredOutput(routeSchema)` + `routeSchema.parse`, prompt from `router-prompt.ts`, message (+ optional context snippet)
- [x] T027 [US2] In router node of `src/graph/production-graph.ts`, on LLM path append TraceEvent `{ type:"route", node:"router", content: reason, route, override: false }`; on failure/invalid apply fallback `react` per research
- [x] T028 [US2] Ensure `llmCalls`/metrics account for router call when classification runs (increment or merge into turn metrics) in `src/graph/production-graph.ts`

**Checkpoint**: Auto-roteamento + evento `route` + fallback testáveis sem rede

---

## Phase 5: User Story 3 — `strategy` Opcional como Override (Priority: P1)

**Goal**: `strategy` no body (ou `reflect:true` sem strategy) bypassa LLM router; trace marca `override: true`; desconhecida → `422`

**Independent Test**: Override diverge do classifier fake; só a strategy pedida roda; evento `route.override === true`

### Tests for User Story 3

- [x] T029 [P] [US3] Test: `overrideRoute: "react"` with classifier that would pick `reflect` → only react runs; `override: true` in `src/graph/production-graph.test.ts`
- [x] T030 [P] [US3] HTTP test: `strategy: "plan-and-execute"` → `200` + route override; `strategy: "nope"` → `422` in `src/http/server.test.ts`
- [x] T031 [P] [US3] HTTP/graph test: omit `strategy`, `reflect: true` → override to `reflect` node in `src/http/server.test.ts` or `src/graph/production-graph.test.ts`

### Implementation for User Story 3

- [x] T032 [US3] Change `chatRequestSchema` in `src/http/chat-schema.ts`: `strategy` optional enum of three routes **without** `.default("react")`; keep `reflect` boolean default `false`
- [x] T033 [US3] In `src/http/server.ts`, map body → `overrideRoute` (`strategy` wins; else `reflect` → `"reflect"`; else undefined); validate unknown before graph; pass into `runProductionTurn`
- [x] T034 [US3] Router node bypass: when `overrideRoute` set, skip LLM, emit `{ type:"route", override: true, route, content: "override from request" | reason }` in `src/graph/production-graph.ts`
- [x] T035 [US3] Update legacy server tests that assumed default `strategy=react` / `resolveStrategy` in `src/http/server.test.ts` to match auto-route or explicit override

**Checkpoint**: Override + `422` + compat `reflect` flag

---

## Phase 6: User Story 4 — Todo Evento de Trace Assinado pelo Nó (Priority: P1)

**Goal**: 100% dos eventos no caminho `/chat` têm `node` coerente; builders e strategies carimbam o id do nó ativo

**Independent Test**: Após `runProductionTurn` com fakes, assertar `trace.every(e => e.node)` e `route` event `node === "router"`

### Tests for User Story 4

- [x] T036 [P] [US4] Test: every event in a full fake turn has non-empty `node`; strategy events use strategy id in `src/graph/production-graph.test.ts`
- [x] T037 [P] [US4] Test: `buildTraceFromMessages(msgs, "react")` stamps `node: "react"` in `src/trace/builder.test.ts`
- [x] T038 [P] [US4] HTTP assertion: `200` response trace all have `node` and ≥1 `type:"route"` in `src/http/server.test.ts`

### Implementation for User Story 4

- [x] T039 [US4] Ensure ReAct / plan-execute / reflect paths pass the graph node id into trace builders (`src/agents/react.ts`, `src/strategies/plan-execute.ts`, `src/strategies/reflect.ts`) when invoked from graph (constructor option or run input) — default stamp with strategy `name` if unset
- [x] T040 [US4] Stamp `summarize` and any context-side events with `node: "context"` in `src/graph/production-graph.ts` / summarizer call site
- [x] T041 [US4] Audit test fixtures constructing `TraceEvent` without `node` (grep) and fix under `src/**/*.test.ts` until `npm run typecheck` + targeted tests green

**Checkpoint**: SC-001 observabilidade do grafo satisfeita

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento quickstart + CI verde

- [x] T042 [P] Tick SC checklist items in `specs/013-unified-production-graph/quickstart.md`
- [x] T043 Run full `npm test` and `npm run typecheck`; fix regressions (Arena stamps, compose-prompt, learning reflector traces)
- [x] T044 [P] Grep for remaining `resolveStrategy(` / `strategy.default("react")` on `/chat` path in `src/http/`; remove dead default-react selection from production chat path (keep registry helpers for Arena if still used)
- [x] T045 [P] Confirm Arena (`src/arena.ts`) still runs with stamped `node` on traces; minimal fix only if typecheck/tests fail

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP graph + wire
- **US2 (Phase 4)**: Depends on US1 graph skeleton (router node exists)
- **US3 (Phase 5)**: Depends on US1 (+ ideally US2 route event shape); override bypass
- **US4 (Phase 6)**: Depends on US1 turn producing trace; hardens `node` everywhere
- **Polish (Phase 7)**: Depends on US1–US4

### User Story Dependencies

- **US1**: After Foundational — MVP
- **US2**: After US1 (needs router node + injectable classify hook)
- **US3**: After US1 (override field on state); can proceed in parallel with US2 once route event shape agreed
- **US4**: After US1; complements US2/US3 assertions

### Within Each Story

- Tests (marked) written first and failing before implementation
- Graph core before HTTP wire
- LLM router after injectable stub path
- Override schema after graph accepts `overrideRoute`

### Parallel Opportunities

- T002 ∥ T003 ∥ T004 ∥ T005 (setup files)
- T009 ∥ T010 after T006
- T013 ∥ T014 (US1 tests)
- T023 ∥ T024 ∥ T025 (US2 tests)
- T029 ∥ T030 ∥ T031 (US3 tests)
- T036 ∥ T037 ∥ T038 (US4 tests)
- T042 ∥ T044 ∥ T045 (polish)
- After US1: Dev A on US2 router LLM, Dev B on US3 schema/HTTP override

---

## Parallel Example: User Story 2

```bash
# Launch US2 router tests together:
Task: "Test: ROUTER_SYSTEM_PROMPT includes three routes"
Task: "Test: fake classifier emits route event and runs plan-and-execute"
Task: "Test: throwing classifier falls back to react"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US1 — graph + `/chat` wire with injectable router
3. **STOP and VALIDATE**: fake turn end-to-end
4. Then US2 → US3 → US4

### Incremental Delivery

1. Setup + Foundational → `node`/`route` types
2. US1 → unified production graph (MVP)
3. US2 → LLM router + `route` event + fallback
4. US3 → optional `strategy` override + `422`
5. US4 → 100% `node` coverage
6. Polish → quickstart + green CI

### Parallel Team Strategy

With two developers after US1:

- Dev A: US2 (`router.ts` + classify + fallback tests)
- Dev B: US3 (`chat-schema.ts` + server override + HTTP tests)
- Then pair on US4 stamp audit

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Arena/bench multi-strategy comparison stays outside production graph (research Decision 7)
- Retry/fallback de modelo e ondas fora de escopo
- Canonical node ids: `context`, `router`, `react`, `plan-and-execute`, `reflect`, `response`
- Commit after each task or logical group
- Prefer injectable `classifyRoute` in graph deps for deterministic tests (no network)
