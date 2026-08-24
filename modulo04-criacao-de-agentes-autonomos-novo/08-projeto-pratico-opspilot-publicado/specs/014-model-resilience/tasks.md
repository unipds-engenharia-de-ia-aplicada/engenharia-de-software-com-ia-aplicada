# Tasks: Resiliência de Modelo (Retry + Fallback)

**Input**: Design documents from `/specs/014-model-resilience/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-010 / SC-001–SC-004; fakes sem rede; evento `fallback`; `modelUsed`; HTTP 503

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold de telemetria, erro de domínio e documentação de env

- [x] T001 [P] Add `OPENROUTER_MODEL_FALLBACK=` to `.env.example` (keep existing `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`)
- [x] T002 [P] Add `ModelUnavailableError` class in `src/domain/errors.ts`
- [x] T003 [P] Create `src/llm/model-telemetry.ts` with ALS stubs: `runWithModelTelemetry`, `getModelTelemetry`, `recordModelSuccess`, `recordFallbackUsed`, `ModelTelemetry` type (no-op / in-memory until US2 fills behavior)
- [x] T004 [P] Create `src/agents/model.test.ts` with a smoke import so `npm test` picks up the file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio + tipagem `OpsChatModel` — **BLOCKS** all user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T005 Extend `TraceEventType` with `"fallback"` in `src/domain/types.ts`
- [x] T006 [P] Add optional `modelUsed?: string` on `ExecutionMetrics` in `src/domain/types.ts` (required on `/chat` 200 by US2 wire)
- [x] T007 Export `OpsChatModel` type alias and `normalizeFallback(env, primaryId)` helper stubs from `src/agents/model.ts` (keep current `createModel` behavior until US1)
- [x] T008 Widen `modelFactory: () => ChatOpenAI` to `() => OpsChatModel` (or equivalent) in `src/agents/react.ts`, `src/strategies/plan-execute.ts`, `src/strategies/reflect.ts`, `src/chat/history-summarizer.ts`, `src/memory/learning-reflector.ts`, `src/graph/router.ts`, `src/http/server.ts` — compile-only; no behavior change
- [x] T009 Run `npm run typecheck` and fix signature fallout from T008

**Checkpoint**: Tipos prontos; stories podem começar

---

## Phase 3: User Story 1 — Fábrica Única Blindada (Priority: P1) 🎯 MVP

**Goal**: `createModel` aplica `withRetry` no primário e `withFallbacks([reserva])` quando `OPENROUTER_MODEL_FALLBACK` é válido e distinto

**Independent Test**: Harness com fakes — primário flaky recupera; com fallback env, composição inclui reserva; sem env, só retry

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T010 [P] [US1] Test: `normalizeFallback` trims, drops empty, drops equal-to-primary in `src/agents/model.test.ts`
- [x] T011 [P] [US1] Test: injectable factory path — primary fails then succeeds within retries; no fallback invoked (fake runnables) in `src/agents/model.test.ts`
- [x] T012 [P] [US1] Test: primary always fails + reserve ok → reserve result returned when fallback configured in `src/agents/model.test.ts`

### Implementation for User Story 1

- [x] T013 [US1] Implement `baseModel(modelId)` + `normalizeFallback` + `createModel` composition in `src/agents/model.ts` per `contracts/model-factory.md` (`withRetry({ stopAfterAttempt: 3 })`, optional `withFallbacks({ fallbacks: [reserve] })`)
- [x] T014 [US1] Ensure `src/llm/factory.ts` reexports the resilient `createModel` / `OpsChatModel`
- [x] T015 [US1] Smoke: `createReactAgent` / `.withStructuredOutput` still work with returned model type (minimal compile or unit assert in `src/agents/model.test.ts`); adjust composition order if runtime requires structured-output before wrappers
- [x] T016 [US1] Confirm arena/bench/index still pass `createModel` as `modelFactory` without parallel naked `new ChatOpenAI` in production chat path (`src/index.ts`, `src/arena.ts`, `src/bench.ts` — grep and fix if any)

**Checkpoint**: MVP — fábrica blindada; telemetria/503 ainda incompletos

---

## Phase 4: User Story 2 — Observabilidade (`fallback` + `modelUsed`) (Priority: P1)

**Goal**: Turno `/chat` 200 reporta `metrics.modelUsed`; quando a reserva atende, `trace` inclui `type: "fallback"`

**Independent Test**: Telemetria fake / ALS — fallbackUsed → evento + modelUsed=reserva; sucesso primário → sem evento fallback

### Tests for User Story 2

- [x] T017 [P] [US2] Unit tests for ALS telemetry record/read/clear in `src/llm/model-telemetry.ts` (or colocated `model-telemetry.test.ts`)
- [x] T018 [P] [US2] Test: after resilient invoke with forced fallback, `getModelTelemetry().fallbackUsed` and `modelUsed` match reserve id in `src/agents/model.test.ts`
- [x] T019 [P] [US2] Graph/HTTP test: successful turn sets `metrics.modelUsed`; fallback path includes `type:"fallback"` in `src/graph/production-graph.test.ts` and/or `src/http/server.test.ts`

### Implementation for User Story 2

- [x] T020 [US2] Implement telemetry callbacks/tags on `baseModel` in `src/agents/model.ts` writing to `src/llm/model-telemetry.ts`
- [x] T021 [US2] Wrap `runProductionTurn` (or graph invoke) with `runWithModelTelemetry` in `src/graph/production-graph.ts`
- [x] T022 [US2] After successful turn in `src/graph/production-graph.ts`, set `metrics.modelUsed` from telemetry (default primary id) and append `TraceEvent` `{ type:"fallback", node:"resposta", content:"primary → fallback" }` when `fallbackUsed`
- [x] T023 [US2] Extend `ChatTurnResult["metrics"]` typing in `src/graph/production-graph.ts` to include `modelUsed: string`

**Checkpoint**: Observabilidade no `200` de `/chat`

---

## Phase 5: User Story 3 — Degradação 503 (Priority: P1)

**Goal**: Primário (+ reserva se houver) esgotados → `ModelUnavailableError` → HTTP **503** `{ error: "model_unavailable" }`

**Independent Test**: All-fail harness → `503`; nunca `200` com answer inventada

### Tests for User Story 3

- [x] T024 [P] [US3] Test: factory/all-fail surfaces error mappable to `ModelUnavailableError` in `src/agents/model.test.ts`
- [x] T025 [P] [US3] HTTP test: injected failing modelFactory / graph path returns `503` and `error: "model_unavailable"` in `src/http/server.test.ts`

### Implementation for User Story 3

- [x] T026 [US3] Normalize exhausted LLM/provider failures to `ModelUnavailableError` at turn boundary in `src/graph/production-graph.ts` (or thin helper in `src/agents/model.ts`)
- [x] T027 [US3] Map `ModelUnavailableError` → status `503` body `{ error: "model_unavailable", message }` in `src/http/server.ts` (keep `504` for chat timeout)
- [x] T028 [US3] Ensure primary-only (no fallback env) all-fail also yields `503` (covered by T025 or dedicated case in `src/http/server.test.ts`)

**Checkpoint**: Escada completa retry → fallback → 503

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento quickstart + CI verde

- [x] T029 [P] Tick SC checklist items in `specs/014-model-resilience/quickstart.md`
- [x] T030 Run full `npm test` and `npm run typecheck`; fix regressions from `OpsChatModel` / telemetry ALS
- [x] T031 [P] Grep for naked `new ChatOpenAI(` outside `src/agents/model.ts` on production paths; leave only `baseModel` construction inside the factory
- [x] T032 [P] Document in a one-line comment atop `createModel` in `src/agents/model.ts` the ladder: retry → fallback → ModelUnavailableError

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP factory
- **US2 (Phase 4)**: Depends on US1 resilient invoke (telemetry hooks on real composition)
- **US3 (Phase 5)**: Depends on US1 (failure path); can start HTTP mapping in parallel with US2 once error type exists
- **Polish (Phase 6)**: Depends on US1–US3

### User Story Dependencies

- **US1**: After Foundational — no dependency on US2/US3
- **US2**: After US1 (+ Setup telemetry stubs)
- **US3**: After T002 error class + US1 failure behavior; HTTP wire independent of fallback event details

### Within Each Story

- Tests (marked) written first and failing before implementation
- Factory composition before consumer smoke
- Telemetry before graph metrics wire
- Error normalization before HTTP 503 mapping

### Parallel Opportunities

- T001 ∥ T002 ∥ T003 ∥ T004 (setup)
- T005 ∥ T006 after types touchpoints clear
- T010 ∥ T011 ∥ T012 (US1 tests)
- T017 ∥ T018 ∥ T019 (US2 tests)
- T024 ∥ T025 (US3 tests)
- T029 ∥ T031 ∥ T032 (polish)
- After US1: Dev A on US2 telemetry/graph; Dev B on US3 503 HTTP

---

## Parallel Example: User Story 1

```bash
# Launch US1 factory tests together:
Task: "Test: normalizeFallback trims/drops in src/agents/model.test.ts"
Task: "Test: primary flaky recovers without fallback in src/agents/model.test.ts"
Task: "Test: primary fail + reserve ok returns reserve in src/agents/model.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US1 — resilient `createModel`
3. **STOP and VALIDATE**: fake retry/fallback composition
4. Then US2 → US3

### Incremental Delivery

1. Setup + Foundational → types / OpsChatModel
2. US1 → fábrica blindada (MVP)
3. US2 → `modelUsed` + evento `fallback`
4. US3 → HTTP 503
5. Polish → quickstart + green CI

### Parallel Team Strategy

With two developers after US1:

- Dev A: US2 (`model-telemetry` + `production-graph` metrics/trace)
- Dev B: US3 (`ModelUnavailableError` → `server.ts` 503 + HTTP tests)

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Prefer injectable seams in `createModel` tests (don't hit OpenRouter)
- `stopAfterAttempt: 3` is canonical (research); do not add extra env for retries in v1
- Keep chat timeout **504** distinct from model **503**
- Commit after each task or logical group
