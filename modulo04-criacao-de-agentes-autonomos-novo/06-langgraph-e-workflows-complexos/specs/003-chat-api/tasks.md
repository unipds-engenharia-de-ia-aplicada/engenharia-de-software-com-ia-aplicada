# Tasks: Chat HTTP API

**Input**: Design documents from `/specs/003-chat-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-011 e constitution princípio 5 exigem teste de integração com estratégia fake determinística (sem rede); SC-002–SC-005 cobertos em `src/http/server.test.ts`.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create HTTP and agents module scaffolds per plan.md

- [x] T001 Create directory `src/http/` and scaffold `src/http/chat-schema.ts` with placeholder `chatRequestSchema` export matching `contracts/chat-http.md`
- [x] T002 [P] Scaffold `src/http/server.ts` with placeholder exports `createApp` and `startServer` per `plan.md` / `research.md`
- [x] T003 [P] Scaffold `src/agents/index.ts` with placeholder exports `createRegistry`, `resolveStrategy`, and type `StrategyRegistry` per `contracts/agents-registry.md`
- [x] T004 [P] Create empty test file `src/http/server.test.ts` importing `node:test` / `node:assert` ready for US1–US4 cases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain errors, zod schema, registry resolve, and Express app factory that ALL stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add `UnknownStrategyError` and `ChatTimeoutError` classes to `src/domain/errors.ts` per `data-model.md`
- [x] T006 [P] Implement `chatRequestSchema` (`message` min 1, `strategy` default `"react"`, `reflect` default `false`) and export type `ChatRequest` in `src/http/chat-schema.ts` per `contracts/chat-http.md` and `research.md` Decisão 3
- [x] T007 Implement `createRegistry` and `resolveStrategy` in `src/agents/index.ts` (lookup → `UnknownStrategyError`; `reflect:true` → `withReflection(base, reflectionOpts)`) per `contracts/agents-registry.md`
- [x] T008 Implement `createApp(deps)` in `src/http/server.ts`: `express.json()`, `POST /chat` stub that parses body with `chatRequestSchema` and returns placeholder; accept `ChatAppDeps` `{ registry, timeoutMs?, reflectionOpts? }` (defaults `timeoutMs: 180_000`) per `research.md` Decisão 1
- [x] T009 [P] Implement `startServer(app, port)` (or equivalent listen helper) in `src/http/server.ts`
- [x] T010 Run `npm run typecheck` and confirm new modules compile under `strict: true`

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Plantonista Conversa com o Agente via HTTP (Priority: P1) 🎯 MVP

**Goal**: `POST /chat` resolves strategy from registry (default `react`), optionally applies reflection, runs the strategy, and returns `200` `{ answer, trace, metrics }`.

**Independent Test**: Register a fake deterministic strategy; `POST /chat` with `{"message":"..."}` returns `200` with the fake answer and metrics — no network.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Integration test: happy path with fake strategy registered as `react` — `POST /chat` `{ "message": "oi" }` → `200` + `{ answer, trace, metrics }` in `src/http/server.test.ts`
- [x] T012 [P] [US1] Integration test: explicit `strategy` name selects that registry entry (fake under a second key) in `src/http/server.test.ts`
- [x] T013 [P] [US1] Integration test: `reflect: true` with injected mock `critic` that approves — `200` and decorated path runs (name/metrics/critique as applicable) in `src/http/server.test.ts` (SC-006)

### Implementation for User Story 1

- [x] T014 [US1] Complete `POST /chat` success path in `src/http/server.ts`: parse → `resolveStrategy` → `run(message)` → `200` JSON `StrategyResult` shape per `contracts/chat-http.md`
- [x] T015 [US1] Add test helper in `src/http/server.test.ts` to start `createApp` on ephemeral port (`listen(0)`) and `fetch`, with fake `ReasoningStrategy` factory (no network)
- [x] T016 [US1] Wire production bootstrap in `src/index.ts`: build registry from `bootstrapOpsPilot()` strategies (`react`, `plan-and-execute`), `createApp({ registry, reflectionOpts: { modelFactory: createModel } })`, `listen(PORT)` with `PORT = process.env.PORT ?? 3000` (FR-012)
- [x] T017 [US1] Run US1 cases in `src/http/server.test.ts` via `npm test` until green

**Checkpoint**: MVP — plantonista receives answer+trace+metrics over HTTP with fake strategy

---

## Phase 4: User Story 2 — Fronteira Rejeita Entrada Inválida e Estratégia Desconhecida (Priority: P2)

**Goal**: Invalid bodies → `400` with zod `issues`; unknown strategy → `422`; defaults applied when fields omitted.

**Independent Test**: Invalid/unknown requests never call `run()`; assert status and error body shape.

### Tests for User Story 2 ⚠️

- [x] T018 [P] [US2] Integration test: missing/`mensagem` wrong field / empty `message` → `400` + `error: "validation_error"` + `issues` in `src/http/server.test.ts` (SC-002)
- [x] T019 [P] [US2] Integration test: valid body with `strategy: "nope"` → `422` + `error: "unknown_strategy"` in `src/http/server.test.ts` (SC-003)
- [x] T020 [P] [US2] Integration test: omit `strategy` and `reflect` → defaults resolve `react` / no reflection (spy or registry with only `react`) in `src/http/server.test.ts`

### Implementation for User Story 2

- [x] T021 [US2] Map `ZodError` / invalid JSON to `400` `{ error: "validation_error", issues }` in `src/http/server.ts` per `research.md` Decisão 4 (do not call strategy)
- [x] T022 [US2] Map `UnknownStrategyError` to `422` `{ error: "unknown_strategy", strategy }` in `src/http/server.ts`
- [x] T023 [US2] Map unexpected errors to `500` `{ error: "internal_error", message }` without stack in `src/http/server.ts`
- [x] T024 [US2] Run US2 cases in `src/http/server.test.ts` via `npm test` until green

**Checkpoint**: User Stories 1 AND 2 — frontier validation complete

---

## Phase 5: User Story 3 — Timeout Protege o Cliente (Priority: P3)

**Goal**: Strategy execution capped by `timeoutMs` (prod 180s); overrun → `504`.

**Independent Test**: Fake slow strategy + injected short `timeoutMs` → `504` without waiting 180s.

### Tests for User Story 3 ⚠️

- [x] T025 [P] [US3] Integration test: fake strategy delays beyond injected `timeoutMs` (e.g. 50) → `504` + `error: "timeout"` in `src/http/server.test.ts` (SC-005)
- [x] T026 [P] [US3] Integration test: fast fake still returns `200` well under timeout in `src/http/server.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Wrap `strategy.run(message)` in `Promise.race` with timer using `deps.timeoutMs` (default `180_000`); on timeout throw `ChatTimeoutError` in `src/http/server.ts` (research Decisão 2)
- [x] T028 [US3] Map `ChatTimeoutError` to HTTP `504` `{ error: "timeout", message }` in `src/http/server.ts`
- [x] T029 [US3] Run US3 cases in `src/http/server.test.ts` via `npm test` until green (no wall-clock 180s waits)

**Checkpoint**: Timeout guardrail verified

---

## Phase 6: User Story 4 — Registry Permite Trocar Estratégia sem Mudar a Rota (Priority: P4)

**Goal**: Extensibility — new strategy = registry entry; `reflect` decorates resolved base; fake-only registry proves full HTTP pipe without production strategies.

**Independent Test**: App built only with `{ fake: FakeStrategy }`; `/chat` with that name (or as default key) works end-to-end; `reflect:true` uses `withReflection`.

### Tests for User Story 4 ⚠️

- [x] T030 [P] [US4] Integration test: registry containing only a custom-named fake — `POST /chat` with that `strategy` succeeds (`200`) in `src/http/server.test.ts`
- [x] T031 [P] [US4] Unit/integration test: `resolveStrategy` with `reflect: true` returns strategy whose `name` starts with `reflect:` in `src/agents/index.ts` coverage via `src/http/server.test.ts` or colocated `src/agents/index.test.ts` if preferred

### Implementation for User Story 4

- [x] T032 [US4] Ensure production registry wiring in `src/index.ts` / bootstrap uses `createRegistry({ react, "plan-and-execute": ... })` with correct Arena-aligned keys (assumption in spec)
- [x] T033 [US4] Optionally export `listStrategies(registry)` from `src/agents/index.ts` for debug/error messages (contracts/agents-registry.md)
- [x] T034 [US4] Run US4 cases + full `npm test` until green

**Checkpoint**: All four user stories independently verifiable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification against quickstart and constitution gates

- [x] T035 [P] Confirm `npm run typecheck` clean after all HTTP/agents changes
- [x] T036 Run full `npm test` suite (existing reflect/store/trace + new `server.test.ts`) green
- [x] T037 [P] Walk `specs/003-chat-api/quickstart.md` automated section (test + typecheck) and fix any doc/command drift
- [x] T038 Verify `package.json` script `dev` still points at `src/index.ts` and that module starts the HTTP server (listen), not only library exports

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; best after US1 success path exists (same `server.ts` handler)
- **US3 (Phase 5)**: Depends on US1 success path (wraps `run`)
- **US4 (Phase 6)**: Depends on Foundational registry + US1 HTTP pipe; can overlap with US2/US3 tests in same file carefully
- **Polish (Phase 7)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — no dependency on US2–US4
- **US2 (P2)**: After Phase 2; shares `POST /chat` handler with US1 (sequential edits to `server.ts` recommended)
- **US3 (P3)**: After US1 `run()` path exists
- **US4 (P4)**: After Phase 2 registry; validates extensibility of US1 pipe

### Within Each User Story

- Tests first (fail) → implementation → `npm test` green
- Schema/registry before handler behavior
- Error mapping before asserting status codes

### Parallel Opportunities

- T002, T003, T004 after T001 directory exists
- T006 parallel with T005
- T011–T013 tests in parallel once harness exists (or after T015 helper)
- T018–T020 parallel; T025–T026 parallel; T030–T031 parallel
- T035 and T037 parallel in Polish

---

## Parallel Example: User Story 1

```bash
# After foundational + test harness helper:
Task: "T011 Integration test happy path fake react in src/http/server.test.ts"
Task: "T012 Integration test explicit strategy selection in src/http/server.test.ts"
Task: "T013 Integration test reflect:true with mock critic in src/http/server.test.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "T018 Integration test 400 validation_error in src/http/server.test.ts"
Task: "T019 Integration test 422 unknown_strategy in src/http/server.test.ts"
Task: "T020 Integration test defaults strategy/reflect in src/http/server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 (tests → handler → `index.ts` listen)
4. **STOP and VALIDATE**: fake strategy `200` via `npm test`
5. Optionally smoke `npm run dev` + curl (needs API key)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP chat HTTP
3. US2 → validation frontier
4. US3 → timeout guardrail
5. US4 → registry extensibility proof
6. Polish → typecheck + full suite + quickstart

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: one person on US1 handler; another drafts US2–US3 tests in `server.test.ts` (coordinate merges on same files)

---

## Notes

- [P] = different files, no incomplete dependencies
- Timeout tests MUST inject short `timeoutMs` — never wait 180s in CI
- Strategy names: `react` | `plan-and-execute` (no `plan-execute` alias)
- Commit after each task or logical group (constitution: pequeno e reversível)
- Avoid editing Arena CLI in this feature unless needed for shared helpers (out of scope per plan)
