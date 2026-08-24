# Tasks: Medição de Contexto

**Input**: Design documents from `/specs/010-context-measurement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-008 / SC-001–SC-005; constitution princípio 5; input “Com testes”; TDD por story; fake strategy / usage sintético (sem rede LLM).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`; script em `scripts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold do módulo `context/` per plan.md / contracts/tokens.md

- [x] T001 Create directory `src/context/` and scaffold `src/context/tokens.ts` with exported stubs: `estimateTokens`, `readLlmUsage`, `sumPromptTokensFromMessages`, `buildContextBreakdown` (+ types `LlmUsage`, `ContextBreakdown`) per `contracts/tokens.md`
- [x] T002 [P] Scaffold empty `src/context/tokens.test.ts` with `node:test` / `node:assert/strict` imports ready for US1

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio estendidos — bloqueia strategies e `runChat`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extend `ExecutionMetrics` in `src/domain/types.ts` with optional `promptTokens?: number` and `contextBreakdown?: ContextBreakdown` (export `ContextBreakdown` here or re-export from `src/context/tokens.ts` — prefer single source in `tokens.ts` + import in types, or define interface in `types.ts` matching `data-model.md`)
- [x] T004 Align `ChatTurnResult.metrics` typing in `src/chat/run-chat.ts` so it can carry `promptTokens?` + `contextBreakdown` without breaking existing fields (`historyMessages`, `recalledMemories`)
- [x] T005 Run `npm run typecheck` and confirm stubs + type extensions compile under `strict: true`

**Checkpoint**: Foundation ready — tokens module e wire de métricas podem começar

---

## Phase 3: User Story 1 — Estimar e Ler Uso de Tokens (Priority: P1) 🎯 MVP

**Goal**: Módulo canônico `estimateTokens` (floor chars/4) + `readLlmUsage` / `sumPromptTokensFromMessages` a partir do usage LangChain, sem rede.

**Independent Test**: `npm test --` (ou arquivo) `src/context/tokens.test.ts` — bordas de estimativa + parse usage + soma / undefined.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Test `estimateTokens` for `""`, length 1/3/4/5, and accented PT string using `Math.floor(n/4)` in `src/context/tokens.test.ts` (SC-001 / FR-001)
- [x] T007 [P] [US1] Test `readLlmUsage` with `usage_metadata.input_tokens`, fallback `tokenUsage.promptTokens`, and malformed/`undefined` → `undefined` in `src/context/tokens.test.ts` (FR-002)
- [x] T008 [P] [US1] Test `sumPromptTokensFromMessages`: two messages with usage → sum; none with usage → `undefined` in `src/context/tokens.test.ts` (research Decisão 2)
- [x] T009 [P] [US1] Test `buildContextBreakdown` maps each key to `estimateTokens` of its string in `src/context/tokens.test.ts` (FR-004 prep)

### Implementation for User Story 1

- [x] T010 [US1] Implement `estimateTokens` as `Math.floor(text.length / 4)` in `src/context/tokens.ts` (research Decisão 1)
- [x] T011 [US1] Implement `readLlmUsage` (defensive parse: `usage_metadata` → `tokenUsage` → flat aliases; never throw) in `src/context/tokens.ts`
- [x] T012 [US1] Implement `sumPromptTokensFromMessages` and `buildContextBreakdown` in `src/context/tokens.ts` per `contracts/tokens.md`
- [x] T013 [US1] Run US1 cases via `npm test` until `src/context/tokens.test.ts` is green (no rede LLM)

**Checkpoint**: MVP — utilitário de tokens testado e utilizável pelas stories seguintes

---

## Phase 4: User Story 2 — Métricas de Contexto no `/chat` (Priority: P1)

**Goal**: `POST /chat` devolve `metrics.promptTokens` (usage real quando disponível) e `metrics.contextBreakdown` estimado (`system` | `history` | `memories` | `message`); strategies preenchem `promptTokens`.

**Independent Test**: Fake strategy com/sem `promptTokens` + history/memories controlados — assert HTTP/`runChat` metrics per `contracts/chat-http.md`.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Test `runChat` / compose: fake strategy with `promptTokens: 42` appears in result metrics; without field → `promptTokens` omitted in `src/chat/compose-prompt.test.ts` (SC-002 / FR-003 / FR-009)
- [x] T015 [P] [US2] Test `contextBreakdown` always has four keys; with empty history/memories → `0`; `message` uses raw user text; values match `estimateTokens` in `src/chat/compose-prompt.test.ts` (SC-003 / FR-005)
- [x] T016 [P] [US2] Test HTTP `POST /chat` response includes `contextBreakdown` and optional `promptTokens` with fake registry in `src/http/server.test.ts` (FR-006)
- [x] T017 [P] [US2] Test `withReflection` sums defined `promptTokens` across base runs (omit if none) in `src/strategies/reflect.test.ts` (research Decisão 3)

### Implementation for User Story 2

- [x] T018 [US2] In `src/chat/run-chat.ts`, after strategy success, build breakdown via `buildContextBreakdown` using `OPSPILOT_SYSTEM_PROMPT`, history text, recalled facts text, and raw `input.message`; merge into metrics; copy `promptTokens` only if `!== undefined`
- [x] T019 [US2] Update `ReactStrategy` in `src/agents/react.ts` to set `metrics.promptTokens` from `sumPromptTokensFromMessages(result.messages)` (and on recursion-limit path omit / undefined)
- [x] T020 [P] [US2] Update `PlanExecuteStrategy` in `src/strategies/plan-execute.ts` to accumulate `promptTokens` from agent AIMessages and planner/replanner invokes when usage is present
- [x] T021 [US2] Update `withReflection` in `src/strategies/reflect.ts` to aggregate `promptTokens` from nested strategy results (best-effort critic; do not invent estimates)
- [x] T022 [US2] Run US2 cases via `npm test` until compose / server / reflect tests are green

**Checkpoint**: `/chat` observa prompt real + breakdown estimado

---

## Phase 5: User Story 3 — Script Longo Mostra `promptTokens` por Turno (Priority: P2)

**Goal**: `scripts/conversa-longa.sh` imprime `promptTokens` (ou `n/a`) por turno a partir de `metrics`.

**Independent Test**: Inspecionar script (ou dry-run com JSON fixture) — linha contém `promptTokens=`; ausência → `n/a` sem abortar.

### Tests for User Story 3 ⚠️

- [x] T023 [P] [US3] Assert `scripts/conversa-longa.sh` contains `jq` extraction of `.metrics.promptTokens` with `n/a` fallback (grep/string check in a small test file or document manual check in quickstart — prefer a lightweight `scripts/conversa-longa.test.sh` **or** comment + quickstart checkbox; if no bash test harness, validate via `rg` in `src/context/tokens.test.ts` notes is insufficient — add assertion in polish OR a node test that reads the script file and checks the pattern) in a colocated check: e.g. test file `scripts/conversa-longa.script.test.ts` that reads the script and asserts `promptTokens` + `n/a` (SC-004 / FR-007)

### Implementation for User Story 3

- [x] T024 [US3] Update `scripts/conversa-longa.sh` printf line to include `promptTokens=$(jq -r '.metrics.promptTokens // "n/a"')`; do not exit solely because metric missing; refresh header comment to mention real `promptTokens`
- [x] T025 [US3] Optionally align local bash `estimate_tokens` comment with floor rule (secondary); keep real `promptTokens` as primary per-turn signal
- [x] T026 [US3] Run US3 script-content test / manual smoke checklist until green

**Checkpoint**: Demo longa mostra crescimento de prompt tokens

---

## Phase 6: User Story 4 — Testes Cobrem Estimativa, Usage e Métricas (Priority: P1)

**Goal**: Suíte completa cobre estimativa, usage e métricas HTTP; `npm test` + `typecheck` verdes (SC-005).

**Independent Test**: `npm test && npm run typecheck` — todos os cenários quickstart §1 passam.

### Tests / Verification for User Story 4 ⚠️

- [x] T027 [P] [US4] Audit and fill any gap vs quickstart table (estimate / usage / fake promptTokens / omit / breakdown) across `src/context/tokens.test.ts`, `src/chat/compose-prompt.test.ts`, `src/http/server.test.ts`
- [x] T028 [US4] Fix any regressions in existing metrics assertions (`historyMessages`, `recalledMemories`, `llmCalls`) after `ExecutionMetrics` extension
- [x] T029 [US4] Run full `npm test` and `npm run typecheck` until green (SC-005 / FR-008)

**Checkpoint**: Aceite automatizado da feature completo

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Alinhamento final com quickstart e contratos

- [x] T030 [P] Walk through `specs/010-context-measurement/quickstart.md` checklist (SC-001–SC-005) and tick off or note gaps
- [x] T031 [P] Confirm learning reflector (`009`) is **not** included in turn `promptTokens` (no await/sum in `run-chat.ts` path)
- [x] T032 Run final `npm test` + `npm run typecheck`; commit-ready tree for feature `010-context-measurement`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: After Foundational — MVP utilitário
- **US2 (Phase 4)**: After US1 (`tokens.ts` APIs must exist)
- **US3 (Phase 5)**: After US2 ideally (needs `promptTokens` in `/chat`); script can be edited earlier but validation needs US2
- **US4 (Phase 6)**: After US1–US3 tests/impl exist — gap-fill + full suite
- **Polish (Phase 7)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories
- **US2 (P1)**: Depends on US1 module APIs
- **US3 (P2)**: Depends on US2 response shape (soft: script can land early)
- **US4 (P1)**: Cross-cutting verification after US1–US3

### Within Each User Story

- Tests FIRST (fail) → implementation → green
- Types before callers
- `runChat` breakdown before relying on HTTP asserts
- Strategies after `sumPromptTokensFromMessages` exists

### Parallel Opportunities

- T001/T002 setup stubs parallel
- T006–T009 US1 tests parallel
- T014–T017 US2 tests parallel
- T019/T020 strategy wires parallel after T018 (or T020 [P] with T019 if careful)
- T027/T030/T031 polish checks parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "Test estimateTokens edges in src/context/tokens.test.ts"
Task: "Test readLlmUsage variants in src/context/tokens.test.ts"
Task: "Test sumPromptTokensFromMessages in src/context/tokens.test.ts"
Task: "Test buildContextBreakdown in src/context/tokens.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch US2 tests together:
Task: "Test runChat promptTokens omit/include in src/chat/compose-prompt.test.ts"
Task: "Test contextBreakdown keys in src/chat/compose-prompt.test.ts"
Task: "Test HTTP metrics in src/http/server.test.ts"
Task: "Test reflect promptTokens sum in src/strategies/reflect.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (`tokens.ts` + tests)
4. **STOP and VALIDATE**: unit tests green
5. Proceed to US2 for product-visible metrics

### Incremental Delivery

1. Setup + Foundational → types ready
2. US1 → utilitário testado (MVP técnico)
3. US2 → `/chat` métricas observáveis (MVP de produto)
4. US3 → script demo
5. US4 + Polish → SC-005 e quickstart

### Parallel Team Strategy

1. Team completes Setup + Foundational
2. Dev A: US1 → then US2 `runChat`
3. Dev B (after US1): strategy wires (T019–T021) + reflect tests
4. Dev C (after US2 shape): US3 script + US4 audit

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Omit `promptTokens` when usage missing — never fake `0` for “unknown”
- `message` in breakdown = raw user message; memories counted separately
- Learning reflector LLM calls out of turn sum
- Commit after each task or logical group
- Avoid: tokenizer deps, changing agent answers, MCP changes
